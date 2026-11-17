"""Execute GMIB's generated scripts against temporary sysfs and mocked OS commands."""
import json
import os
import pathlib
import shutil
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


def expect_exit(expected, run):
    try:
        run()
    except SystemExit as result:
        assert result.code == expected, result.code
    else:
        raise AssertionError(f'Expected exit {expected}')


def test_repair(root, args):
    sys_net = root / 'sys/class/net'
    devices = root / 'sys/devices'
    driver = root / 'rndis_host'
    driver.mkdir()
    assert "pathlib.Path('/sys/class/net')" in args[3]
    script = args[3].replace('/sys/', f'{root}/sys/')
    serial, vendor, product = args[4:7]

    def attach(name, device_serial, device_product):
        parent = devices / name
        device = parent / 'interface'
        entry = sys_net / name
        attributes = [
            (device, {'uevent': 'DEVTYPE=usb_interface'}),
            (parent, {
                'uevent': 'DEVTYPE=usb_device',
                'idVendor': vendor,
                'idProduct': device_product,
                'serial': device_serial,
            }),
            (entry, {'ifindex': '17'}),
        ]
        for directory, fields in attributes:
            directory.mkdir(parents=True, exist_ok=True)
            for key, value in fields.items():
                (directory / key).write_text(value)
        (entry / 'device').symlink_to(device)
        (device / 'driver').symlink_to(driver)

    attach('usb0', serial, product)
    attach('usb1', serial, '0021')
    target = dict(dst='default', dev='usb0', gateway='192.168.2.1', metric=100)
    unrelated = [
        dict(dst='default', dev='wlan0', gateway='10.0.0.1', metric=1),
        dict(dst='default', dev='usb1', gateway='10.1.0.1', metric=50),
    ]
    routes = [target, *unrelated]
    deletes = []

    def ip(arguments, **options):
        if arguments == ['ip', '-j', '-4', 'route', 'show', 'table', 'all']:
            return subprocess.CompletedProcess(arguments, 0, json.dumps(routes).encode())
        assert arguments == [
            'ip', '-4', 'route', 'del', 'default', 'table', 'main',
            'via', target['gateway'], 'dev', target['dev'], 'metric', str(target['metric']),
        ], arguments
        deletes.append(arguments)
        routes.remove(target)
        return subprocess.CompletedProcess(arguments, 0, b'')

    def run(uid=0):
        argv = ['', serial, vendor, product]
        with (
            patch.object(os, 'geteuid', return_value=uid),
            patch.object(sys, 'argv', argv),
            patch.object(subprocess, 'run', side_effect=ip),
        ):
            exec(script, {})

    expect_exit(10, lambda: run(uid=1000))
    run()
    run()
    assert routes == unrelated and len(deletes) == 1

    shutil.rmtree(sys_net / 'usb0')
    expect_exit(11, run)
    attach('enp1s0u1', serial, product)
    target['dev'] = 'enp1s0u1'
    routes.append(target)
    run()
    assert routes == unrelated and len(deletes) == 2

    # An interface change after reading routes invalidates even an exact route.
    routes.append(target)

    def rename_before_delete(arguments, **options):
        result = ip(arguments, **options)
        (sys_net / target['dev'] / 'ifindex').write_text('18')
        return result

    with patch.object(sys, 'argv', ['', serial, vendor, product]), patch.object(
        os, 'geteuid', return_value=0
    ), patch.object(subprocess, 'run', side_effect=rename_before_delete):
        expect_exit(11, lambda: exec(script, {}))
    assert target in routes and len(deletes) == 2


def test_policy(root, enable, disable):
    assert "pathlib.Path('/etc/netplan')" in enable[3]
    assert "pathlib.Path('/sys/class/net')" in enable[3]
    netplan = root / 'etc/netplan'
    netplan.mkdir(parents=True)
    policy = netplan / '90-gmib-taurus-rndis.yaml'
    wired_file = netplan / '50-cloud-init.yaml'
    original_config = 'network:\n  version: 2\n'
    wired_file.write_text(original_config)
    script = enable[3].replace('/sys/', f'{root}/sys/').replace(
        "'/etc/netplan'", repr(str(netplan))
    ).replace("pathlib.Path('/') / scope / 'netplan'", f'pathlib.Path({str(root)!r}) / scope / "netplan"')
    calls = []
    renderer = 'networkd'
    valid = True
    live_repair = True
    real_lstat = pathlib.Path.lstat
    real_fstat = os.fstat

    def root_owned(result):
        fields = list(result)
        fields[4] = 0
        return os.stat_result(fields)

    def os_command(args, **options):
        calls.append(args)
        if args == ['netplan', 'get']:
            output = json.dumps({'network': {'renderer': renderer, 'ethernets': {}}}).encode()
        elif args[:4] == ['networkctl', '--no-pager', '--lines=0', 'status']:
            output = b'    Network File: /run/systemd/network/10-netplan-wired.network\n'
        elif args[:3] == ['netplan', 'generate', '--root-dir']:
            staged = pathlib.Path(args[3])
            assert staged != root and staged != pathlib.Path('/')
            assert (staged / 'etc/netplan/50-cloud-init.yaml').read_text() == original_config
            candidate = staged / 'etc/netplan' / policy.name
            if candidate.exists():
                yaml_text = candidate.read_text()
                assert 'driver: rndis_host' in yaml_text
                assert 'link-local: [ipv4, ipv6]' in yaml_text
                assert 'dhcp4: true' in yaml_text
                assert 'use-dns: false' in yaml_text
                assert 'use-routes: false' in yaml_text
                assert stat.S_IMODE(real_lstat(candidate).st_mode) == 0o600
                generated = staged / 'run/systemd/network/10-netplan-00-gmib-taurus-rndis.network'
                generated.parent.mkdir(parents=True)
                generated.write_text('Driver=rndis_host\nUseRoutes=false\nUseDNS=false\n')
            if not valid:
                raise subprocess.CalledProcessError(1, args)
            output = b''
        else:
            assert args[:3] == ['/usr/bin/python3', '-I', '-c'], args
            assert args[3] == enable[8]
            assert args[4:] == enable[4:7]
            assert policy.exists()
            if not live_repair:
                raise subprocess.CalledProcessError(12, args)
            output = b''
        return subprocess.CompletedProcess(args, 0, output)

    yaml = SimpleNamespace(safe_load=json.loads, YAMLError=ValueError)

    def run(args, uid=0):
        with (
            patch.object(pathlib.Path, 'lstat', lambda path: root_owned(real_lstat(path))),
            patch.object(os, 'fstat', lambda fd: root_owned(real_fstat(fd))),
            patch.object(os, 'geteuid', return_value=uid),
            patch.object(sys, 'argv', ['', *args[4:9]]),
            patch.dict(sys.modules, {'yaml': yaml}),
            patch.object(subprocess, 'run', side_effect=os_command),
        ):
            exec(script, {})

    expect_exit(10, lambda: run(enable, uid=1000))
    assert not policy.exists() and not calls
    renderer = 'NetworkManager'
    expect_exit(16, lambda: run(enable))
    assert not policy.exists()
    renderer = 'networkd'
    valid = False
    expect_exit(14, lambda: run(enable))
    assert not policy.exists()
    valid = True
    live_repair = False
    expect_exit(17, lambda: run(enable))
    assert policy.is_file()
    assert stat.S_IMODE(real_lstat(policy).st_mode) == 0o600
    assert wired_file.read_text() == original_config
    run(disable)
    assert not policy.exists() and wired_file.read_text() == original_config
    assert all(args[:2] != ['networkctl', 'reload'] for args in calls)

    policy.symlink_to(wired_file)
    expect_exit(15, lambda: run(enable))
    expect_exit(15, lambda: run(disable))
    assert policy.is_symlink() and wired_file.read_text() == original_config


if __name__ == '__main__':
    fixture = json.load(sys.stdin)
    with tempfile.TemporaryDirectory() as directory:
        root = pathlib.Path(directory).resolve()
        test_repair(root, fixture['repair'])
        # Repair's fixture ends with an adapter index change; it is still unique.
        test_policy(root, fixture['enable'], fixture['disable'])
