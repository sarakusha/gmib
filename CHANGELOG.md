# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

### [3.6.6](https://github.com/sarakusha/gmib/compare/v3.6.5...v3.6.6) (2022-10-31)


### Bug Fixes

* added update delay after a new device is detected ([f382d6e](https://github.com/sarakusha/gmib/commit/f382d6e717e3f30d576e39d5cdf13a76509a1777))

### 3.6.5 (2022-10-31)


### ⚠ BREAKING CHANGES

* novastar API now REST API
* Rewritten in accordance with the latest security requirements, recommendations and best practices.

### Features

* **AccordionList:** looks like a button (hover/selected) ([935e69d](https://github.com/sarakusha/gmib/commit/935e69d4a219964b48d38990c3aeea3fd630892a))
* added individual screen brightness ([08946ad](https://github.com/sarakusha/gmib/commit/08946adb9cf6cd898830e0d200700850e3e9e09a))
* added overheating protection ([5681373](https://github.com/sarakusha/gmib/commit/5681373c939fa66eeadb5eb0f993f212c8a8c251))
* added program help ([11e03d1](https://github.com/sarakusha/gmib/commit/11e03d1d7527b1d60d8ac37bef9b5961e31fed7f))
* added the ability to distinguish between serial and network devices ([a727e47](https://github.com/sarakusha/gmib/commit/a727e47223cfcffe121885540f0b89202f92de66))
* brightness sliders ([60822e2](https://github.com/sarakusha/gmib/commit/60822e2d0ffb7d36678e3236e259c735e9032bf8))
* determine if there are pending changes ([03d84af](https://github.com/sarakusha/gmib/commit/03d84afe79cd5f7d814cd71fb4f71aa4d7bd3d6a))
* display a pop-up alert if the novastar device finder application is found on the current subnet ([65c14d5](https://github.com/sarakusha/gmib/commit/65c14d59a82f08a06788987fd22be7b59d3d8d97))
* explicit selection of novastar devices ([c637ab5](https://github.com/sarakusha/gmib/commit/c637ab5faba2fc5339992e37a71de597aa1e56eb))
* **flasher:** added module reset ([613fde1](https://github.com/sarakusha/gmib/commit/613fde16fe008c88e403fbbc481c4e2abfed7413))
* implemented master browser for novastar devices ([f8b6eda](https://github.com/sarakusha/gmib/commit/f8b6eda3ca0ebe50b5791a96ef525de54e6d629c))
* improve security ([6f1c511](https://github.com/sarakusha/gmib/commit/6f1c511b7b3952d0d6f84eeb627350d467e27852))
* improved detection of remote host address ([53cb975](https://github.com/sarakusha/gmib/commit/53cb975e4171987e909b5d08be54a535c95051b3))
* increment/decrement brightness buttons ([8b1e592](https://github.com/sarakusha/gmib/commit/8b1e5924c2b54b9b167c3666249392cb802d23f2))
* IP addresses are now allowed for screens ([1ddf1cd](https://github.com/sarakusha/gmib/commit/1ddf1cd6985698294fd1306b25f22b0e00d5c03b))
* novastar rgbv/gamma/mode control ([4bd9251](https://github.com/sarakusha/gmib/commit/4bd925101bbd053d913bfb7edde459c01d63dc78))
* novastar telemetry tab ([8ec9aa9](https://github.com/sarakusha/gmib/commit/8ec9aa9d5ba6445247f9d63ff37995109325da61))
* the light sensor polling interval has been increased to 30 seconds. ([1296226](https://github.com/sarakusha/gmib/commit/12962262bac31775c81044231b74e7df4098fcc3))
* using transitions for the device list ([8a553b2](https://github.com/sarakusha/gmib/commit/8a553b2107d725ffd4070d06f820d966e360943a))
* webpack->vite, improved security ([bb50348](https://github.com/sarakusha/gmib/commit/bb503489221ce63687e690fba3bfc5416c82b4a2))


### Bug Fixes

* add source-map-support to dependencies ([06a229e](https://github.com/sarakusha/gmib/commit/06a229eda437b9b5838bbd15efdc69f10530d4c0))
* adding an existing device ([60d2942](https://github.com/sarakusha/gmib/commit/60d2942ece0cd032c9bb45d469aa5b90b6105973))
* autobrightness (suncalc) ([6a48021](https://github.com/sarakusha/gmib/commit/6a48021fc967640a21b53ad99997e62ce1127b04))
* **config:** skip null values ([58e0ba6](https://github.com/sarakusha/gmib/commit/58e0ba6d31a78f853a3466ae736b5c45ed915586))
* **desktop-entry:** add option --no-sandbox for linux ([4b6c95f](https://github.com/sarakusha/gmib/commit/4b6c95f65ee9db82638f5f6c6e27d3ae84e3a448))
* **editcell:** invalid initial value ([aebcd8a](https://github.com/sarakusha/gmib/commit/aebcd8ab0dca825b84ff4fa8e8acb3ca025c8100))
* filtering by device address ([59afe45](https://github.com/sarakusha/gmib/commit/59afe454ad543a90fef0c1a09d202d0bf47d108e))
* freeze react-imask@6.1 ([b19d4a6](https://github.com/sarakusha/gmib/commit/b19d4a64cd1d430970a38be35afe50e124c75147))
* minihost update after making changes to screen parameters ([e18a153](https://github.com/sarakusha/gmib/commit/e18a15312af3a5c327563a3523d0a49d4a3372dd))
* **minihost2:** invalid property names ([df52d71](https://github.com/sarakusha/gmib/commit/df52d71100e30ae213de9d12b39270167723b12e))
* **minihost:** invert vertical direction ([915f075](https://github.com/sarakusha/gmib/commit/915f0750bf3e9d515539ca96a34917e74fcf2bd9))
* **nibus:** improved algorithm for determining the listed devices when connecting or changing the logical address ([2864a64](https://github.com/sarakusha/gmib/commit/2864a646691e683777490f2eeb074d8ae32f6f9f))
* **quit:** application does not close if a test was shown ([a6593af](https://github.com/sarakusha/gmib/commit/a6593afb3576bbd78a242cc080022b06c5fd6b9d))
* reload devices after changing the current master browser ([ae5b4f3](https://github.com/sarakusha/gmib/commit/ae5b4f3bbf651bc80711d5bee7b4f49f30df0b57))
* resolve promise when cancelled ([0a9f123](https://github.com/sarakusha/gmib/commit/0a9f1235ce84df66c051309ce4a71e80331617fd))
* **screen:** parsing the screen address with offset and size ([8cfd6ab](https://github.com/sarakusha/gmib/commit/8cfd6aba2220d1946e46e902f5629a8e47639bb0))
* serial device polling instead of parallel ([9dbad5f](https://github.com/sarakusha/gmib/commit/9dbad5fa2c4a7ec5be596f36f09de7a55aaa047d))
* setLogLevel novastar ([8b04130](https://github.com/sarakusha/gmib/commit/8b041308ad4d065bf03a434d9931490763f5fb93))
* **TelemetryTab:** update toolbar ([f967a04](https://github.com/sarakusha/gmib/commit/f967a0461332205c3d91bf726e045ba6423bd572))
* transparent test window for some Windows PC ([d0a48e3](https://github.com/sarakusha/gmib/commit/d0a48e3fee5301304da7891281f7157d94271f21))
* **tray:** change icon in astra linux ([d17a3a2](https://github.com/sarakusha/gmib/commit/d17a3a2ee16b46bfd52b6e38ebc519647b483c60))
* updating a non-existent cache ([112b29f](https://github.com/sarakusha/gmib/commit/112b29f7c35754bf9863d3cf4a365c8a69de0690))
* updating the status of serial devices every 30 seconds ([3632d98](https://github.com/sarakusha/gmib/commit/3632d983ee61bbf8a4a908a50429089ec24d9ebd))
* wait for sessions to close before terminating the master browser ([112d28d](https://github.com/sarakusha/gmib/commit/112d28de1c6cc30abb6f98b5b47def7d662825f2))


* novastar API now REST API ([d250bec](https://github.com/sarakusha/gmib/commit/d250bece36cc2e0b57aa8105b38127f189f43157))
