import semver from 'semver';
import type { PluginManifest, PluginSportStatus } from '/@common/plugins';

/** Determine dependencies before activation; invalid components do not block unrelated plugins. */
export function resolvePluginOrder(manifests: PluginManifest[], disabled: string[] = []) {
  const byId = new Map(manifests.map(manifest => [manifest.id, manifest]));
  const errors = new Map<string, string>();
  const order: PluginManifest[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sportOwners = new Map<string, string>();
  for (const manifest of manifests) {
    if (disabled.includes(manifest.id)) continue;
    for (const sport of manifest.contributes?.sports ?? []) {
      const owner = sportOwners.get(sport.id);
      if (owner) {
        errors.set(owner, `Вид спорта ${sport.id} объявлен несколькими плагинами`);
        errors.set(manifest.id, `Вид спорта ${sport.id} объявлен несколькими плагинами`);
      }
      sportOwners.set(sport.id, manifest.id);
    }
  }
  const reaches = (id: string, target: string, seen = new Set<string>()): boolean => {
    if (id === target) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const manifest = byId.get(id);
    return Object.keys({ ...manifest?.dependencies, ...manifest?.optionalDependencies }).some(
      dependency => reaches(dependency, target, seen),
    );
  };
  const visit = (id: string): boolean => {
    if (errors.has(id) || disabled.includes(id)) return false;
    if (visited.has(id)) return true;
    if (visiting.has(id)) {
      errors.set(id, 'Циклическая зависимость плагинов');
      return false;
    }
    const manifest = byId.get(id);
    if (!manifest) return false;
    visiting.add(id);
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
      const target = byId.get(dependency);
      if (!target || !semver.satisfies(target.version, range) || !visit(dependency)) {
        errors.set(id, `Недоступна зависимость ${dependency} ${range}`);
      }
    }
    // Optional integrations influence ordering only; missing/failed providers never block consumers.
    for (const [dependency, range] of Object.entries(manifest.optionalDependencies ?? {})) {
      const target = byId.get(dependency);
      if (
        target &&
        semver.satisfies(target.version, range) &&
        !visiting.has(dependency) &&
        !reaches(dependency, id)
      )
        visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
    if (errors.has(id)) return false;
    order.push(manifest);
    return true;
  };
  manifests.forEach(manifest => visit(manifest.id));
  return { order, errors };
}

export function listPluginSports(
  manifests: PluginManifest[],
  enabled: (id: string) => boolean,
  ready: (id: string) => boolean,
  errors: Map<string, string>,
): PluginSportStatus[] {
  return manifests.flatMap(manifest =>
    (manifest.contributes?.sports ?? []).map(sport => ({
      ...structuredClone(sport),
      pluginId: manifest.id,
      installed: true,
      enabled: enabled(manifest.id),
      ready: ready(manifest.id),
      ...(errors.has(manifest.id) ? { error: errors.get(manifest.id) } : {}),
    })),
  );
}

export class PluginServiceRegistry {
  private entries = new Map<string, { version: string; value: object }>();

  provide(owner: string, name: string, version: string, value: object) {
    const key = `${owner}:${name}`;
    if (
      !/^[a-z][a-z0-9./-]{0,127}$/.test(name) ||
      !semver.valid(version) ||
      !value ||
      typeof value !== 'object'
    )
      throw new Error('Недопустимый сервис');
    if (this.entries.has(key)) throw new Error(`Сервис уже зарегистрирован: ${key}`);
    this.entries.set(key, { version, value: Object.freeze(value) });
  }

  require<T extends object>(
    consumer: PluginManifest,
    owner: string,
    name: string,
    range: string,
  ): T {
    if (
      !Object.hasOwn(consumer.dependencies ?? {}, owner) &&
      !Object.hasOwn(consumer.optionalDependencies ?? {}, owner)
    )
      throw new Error(`Не объявлена зависимость ${owner}`);
    const entry = this.entries.get(`${owner}:${name}`);
    if (!entry || !semver.validRange(range) || !semver.satisfies(entry.version, range))
      throw new Error(`Недоступен сервис ${owner}:${name} ${range}`);
    return entry.value as T;
  }

  remove(owner: string) {
    for (const key of this.entries.keys())
      if (key.startsWith(`${owner}:`)) this.entries.delete(key);
  }
}
