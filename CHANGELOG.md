# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [4.8.13](https://github.com/sarakusha/gmib/compare/v4.8.12...v4.8.13) (2025-04-09)


### Features

* можно сделать плеер не alwaysOnTop ([2a3a6fc](https://github.com/sarakusha/gmib/commit/2a3a6fc438fe49e3e429a0a50032b184c6608347))
* Передача события смены ролика в C22 ([4acf1f1](https://github.com/sarakusha/gmib/commit/4acf1f12b68e2ffee188c8deba6f2241dcfa9a2d))
* событие смены текущего медиа при инициализации и переходу к следующему ([9604055](https://github.com/sarakusha/gmib/commit/96040553491e0a4da190401108351c1aaa7a7e51))
* убран фон в тестовых окнах, для прозрачности ([1a0a398](https://github.com/sarakusha/gmib/commit/1a0a398ef50d6cbf66f94fc6f9db326afe8378ee))

## [4.8.12](https://github.com/sarakusha/gmib/compare/v4.8.11...v4.8.12) (2025-03-25)


### Bug Fixes

* запаздывание при смене яркости экрана ([a4fb812](https://github.com/sarakusha/gmib/commit/a4fb812f0f0261e633a664c27097fb75096611d7))

## [4.8.11](https://github.com/sarakusha/gmib/compare/v4.8.10...v4.8.11) (2025-03-21)


### Features

* ускоренный начальный поиск novastar ([b86e6f6](https://github.com/sarakusha/gmib/commit/b86e6f6bdc69f9e3aa2b6541037d744b4cb7ca8d))


### Bug Fixes

* не управлялась яркость вывод/экран на novastar ([393add5](https://github.com/sarakusha/gmib/commit/393add5aa2ed549f0c45477588ed3f631711560c))

## [4.8.10](https://github.com/sarakusha/gmib/compare/v4.8.8...v4.8.10) (2025-03-12)


### Features

* вывод и копирование mediaId ([a8a4e77](https://github.com/sarakusha/gmib/commit/a8a4e77bf4e9fa79834b0958151ef829e8e905a9))
* добавлен mediaId в setCurrentPlaylistItem ([9c2e4ff](https://github.com/sarakusha/gmib/commit/9c2e4ffdd918e68e9b922ba2e950dd2223daa8b4))
* добавлен mediaId в setCurrentPlaylistItem ([7d6025a](https://github.com/sarakusha/gmib/commit/7d6025a29cf4a12913ab8190a8f347374bcdb33f))
* передача состояния на c22 ([ce07e95](https://github.com/sarakusha/gmib/commit/ce07e953df8597081f80e5236f2ccd1d6d569d6b))
* переход на electron-log@5 ([ea4085a](https://github.com/sarakusha/gmib/commit/ea4085ac382b5221dad02fa12ce8146704edbb29))


### Bug Fixes

* не отслеживались переключения состояния плеера ([723fcf6](https://github.com/sarakusha/gmib/commit/723fcf6c67c90242a3cb174b5dbaa725d7201e9e))
* ошибка при отключении c22 ([8cebfa4](https://github.com/sarakusha/gmib/commit/8cebfa4543891c1d93d4422f1d8a0271aa745ebc))

## [4.8.9](https://github.com/sarakusha/gmib/compare/v4.8.8...v4.8.9) (2025-03-11)


### Features

* вывод и копирование mediaId ([caca35d](https://github.com/sarakusha/gmib/commit/caca35d6338d3541a5fcc6dd7ec67ff725ff8dc1))
* добавлен mediaId в setCurrentPlaylistItem ([7f83742](https://github.com/sarakusha/gmib/commit/7f83742ceecf40f0374f59d12ee57d3d8f6be234))
* передача состояния на c22 ([ac6645f](https://github.com/sarakusha/gmib/commit/ac6645f601551b97179e0abdc406584fac2e9c3d))
* переход на electron-log@5 ([fbc5c4b](https://github.com/sarakusha/gmib/commit/fbc5c4b04116c729315adecf793888d852c27d36))


### Bug Fixes

* не отслеживались переключения состояния плеера ([ff31b91](https://github.com/sarakusha/gmib/commit/ff31b918d02ca8e6dc435afd2054957cee5555b3))

## [4.8.8](https://github.com/sarakusha/gmib/compare/v4.8.7...v4.8.8) (2024-10-29)


### Features

* upgrade novastar lib ([c5d246e](https://github.com/sarakusha/gmib/commit/c5d246e8dc7d7b7077213de4a933300c5f82664c))


### Bug Fixes

* minimize event ([28bde28](https://github.com/sarakusha/gmib/commit/28bde28a4e10739cbb3e385771814d1722e6b1b9))

## [4.8.7](https://github.com/sarakusha/gmib/compare/v4.8.6...v4.8.7) (2024-08-12)


### Features

* обновлены permissions ([9d74a50](https://github.com/sarakusha/gmib/commit/9d74a50294cde5419e955c62d9928eca8b0e2675))


### Bug Fixes

* удаленное подключение ([a469fb0](https://github.com/sarakusha/gmib/commit/a469fb0c29abd6bc9d362f37cd9fa7afa9e127aa))
* удаленное поключение ([6ac62a0](https://github.com/sarakusha/gmib/commit/6ac62a0d0077c5c26569fe4a259ceb45d1e13c08))

## [4.8.6](https://github.com/sarakusha/gmib/compare/v4.8.5-demo...v4.8.6) (2024-08-10)


### Features

* параметры прозрачность и фулскрин ([7fe08ef](https://github.com/sarakusha/gmib/commit/7fe08efa8889b3bcb4541c748bbb4f2a59a4631f))


### Bug Fixes

* изображения не конверировались в видео ([b4dfe67](https://github.com/sarakusha/gmib/commit/b4dfe678953a9b55b5ef8cacc85780c6806da965))
* сброс авторизации ([870a5c3](https://github.com/sarakusha/gmib/commit/870a5c33a90220b77f5749dd3d07abd4e9fe18d1))

## [4.8.5](https://github.com/sarakusha/gmib/compare/v4.8.4...v4.8.5) (2024-01-19)

## [4.8.4](https://github.com/sarakusha/gmib/compare/v4.8.3...v4.8.4) (2024-01-19)


### Features

* запрет автопереключения таба ([eebc3cb](https://github.com/sarakusha/gmib/commit/eebc3cbde9448609f34001473f759424c5b93631))
* свернутые параметры экрана ([d6fa684](https://github.com/sarakusha/gmib/commit/d6fa68444edf5638c9714f0af2159517edaab67d))
* force quit ([0dc167e](https://github.com/sarakusha/gmib/commit/0dc167e1ba590b2ba6c175fcfdfd492c37c75496))


### Bug Fixes

* запрос пароля ([8dadd2e](https://github.com/sarakusha/gmib/commit/8dadd2e07b692c4c16f1ecd9727fe09a3daf3993))
* не обновлялся активный тест ([e097884](https://github.com/sarakusha/gmib/commit/e097884ac0cc24c90d4f0b678bf0c27dd69cc54e))
* опечатка ([b41a8ec](https://github.com/sarakusha/gmib/commit/b41a8ec1963eebb89c8782ebc15155c11a8bfc63))
* отключена сортировка при вводе хоста ([aaa0ef8](https://github.com/sarakusha/gmib/commit/aaa0ef88624205b731f7fac9771d1b7ece380e58))
* перестает стучаться ([7ae0672](https://github.com/sarakusha/gmib/commit/7ae0672aec03fec3802931b1584e1ec89318a455))
* пустой тест при старте ([0c77351](https://github.com/sarakusha/gmib/commit/0c77351afc8891565ed97efc8042cece4b44bb75))
* сохранялось уже удаленное окно ([c2b6b2c](https://github.com/sarakusha/gmib/commit/c2b6b2c749edc0f4b34b256020eefe897be4e245))

## [4.8.3](https://github.com/sarakusha/gmib/compare/v4.8.3-demo...v4.8.3) (2023-12-22)


### Features

* автообновление screens, pages ([d2127bf](https://github.com/sarakusha/gmib/commit/d2127bfcb82d3dced57c6f12f3d71825db3a9938))
* скрытый плеер при удаленном подключении ([db197e9](https://github.com/sarakusha/gmib/commit/db197e9de52defd5c5c2a61bbe16b0d5502fefb5))
* сортировка хостов по имени ([d2eae44](https://github.com/sarakusha/gmib/commit/d2eae44895b2f17cfa2bfab2e991d75052d428d5))


### Bug Fixes

* обращение к не готовой БД ([7bc9b82](https://github.com/sarakusha/gmib/commit/7bc9b82aeda48edf4e44dcad5d72b9f87a2e75c6))
* плейлист из одного ролика ([d58d7d6](https://github.com/sarakusha/gmib/commit/d58d7d69c72aa096e84dd312f244a1b61f8982c2))
* повторный запрос WebRTC ([3b85243](https://github.com/sarakusha/gmib/commit/3b852433bcee62d35bc4cbe971986d2c8add9fa3))
* сообщение отправлялось закрытому окну ([83c934d](https://github.com/sarakusha/gmib/commit/83c934d1412f1ea4ff6fd99a9fb84d04116f6f87))

## [4.8.2](https://github.com/sarakusha/gmib/compare/v4.8.1...v4.8.2) (2023-12-13)


### Features

* автопоиск датчиков на удаленных системах ([7fbd87c](https://github.com/sarakusha/gmib/commit/7fbd87c3b5cb09ff3620cee79cb38123a2089350))
* затемнение окон без фокуса ([2f2cef6](https://github.com/sarakusha/gmib/commit/2f2cef675c58df26e4be50d972b55eb61d28fe58))
* изменена логика закрытия/скрытия окон ([40cc97c](https://github.com/sarakusha/gmib/commit/40cc97c62dbed092537f6893874cd77dda735778))
* не затемняет последнее активное окно ([f57bda7](https://github.com/sarakusha/gmib/commit/f57bda7b9ad10eaba57cc4248adf55b41fc55006))
* убрано ограничение битрейта WebRTC ([0f56aed](https://github.com/sarakusha/gmib/commit/0f56aed3f3ea7d38aecb8e0d1af1be9dffdfc862))
* удаленная настройка pritunl конфига ([1d8a35a](https://github.com/sarakusha/gmib/commit/1d8a35afbc4a6708b8c368c3c5e294695b1831d7))
* удаленное включение автообновления ([0923072](https://github.com/sarakusha/gmib/commit/0923072d7aa89e820f272baaf43dcd1ada6ecd09))


### Bug Fixes

* валидация URL ([dabca6b](https://github.com/sarakusha/gmib/commit/dabca6b8259a00240ef336eb7226d69cd163ac77))
* вывод ошибки в ячейке ([227adc9](https://github.com/sarakusha/gmib/commit/227adc997b0b17679f53c97301a6d35b47ada6b2))
* инвариант в селекторе ([5fee3e1](https://github.com/sarakusha/gmib/commit/5fee3e10a988e023ac2194688ee7bb1cab46d8ae))
* исправлена логика скрыть/показать все ([9bc56a2](https://github.com/sarakusha/gmib/commit/9bc56a20ced5fe1bb76b9092bc041267d6af7cb7))
* исправлена отмена телеметрии ([9dc0f8c](https://github.com/sarakusha/gmib/commit/9dc0f8c47ab5362a41e5fab2a4f1cd6abf20ed92))
* показать все открывало закрытый тест ([5f6815b](https://github.com/sarakusha/gmib/commit/5f6815b8220344ace14cc2e8f2cbf2aff7e2a593))
* скрытие курсора после смены теста ([e47b42c](https://github.com/sarakusha/gmib/commit/e47b42c422740b93bf8a838f94e1adc62446c352))

## [4.8.1](https://github.com/sarakusha/gmib/compare/v4.8.0...v4.8.1) (2023-12-06)

## [4.8.0](https://github.com/sarakusha/gmib/compare/v4.7.4...v4.8.0) (2023-12-06)


### Features

* автопоиск датчиков ([89f4f7f](https://github.com/sarakusha/gmib/commit/89f4f7f6cbc858712f90a0e71e974c8f5b0e476c))
* обновлена справка ([ae72ba3](https://github.com/sarakusha/gmib/commit/ae72ba356e29748017c9e15bc47ea91ed4f1c4c9))
* обновление http-экрана ([65147df](https://github.com/sarakusha/gmib/commit/65147dfd77278ace0de4e949e505afce8d15aa14))
* перегружена функция createDevice ([b04b81a](https://github.com/sarakusha/gmib/commit/b04b81a81ab35b9017dbc8aeb18062840d0db853))
* подтверждение закрытия плеера ([6641c3c](https://github.com/sarakusha/gmib/commit/6641c3c282eaef0e0366b27d1de1c0925a65a537))
* предпросмотр http-виджета ([f1a2156](https://github.com/sarakusha/gmib/commit/f1a2156bc527bd72eca4c41c9b7ee9fae48c8bf5))
* улучшен диалог http-виджета ([fe4c1b8](https://github.com/sarakusha/gmib/commit/fe4c1b8e0d9ac3351f05b7ad4dd5e5718b25bfa9))

## [4.7.4](https://github.com/sarakusha/gmib/compare/v4.7.3...v4.7.4) (2023-11-24)


### Features

* обновлена справка ([3167b5f](https://github.com/sarakusha/gmib/commit/3167b5fb383bcb3a987b298679fcbd48f39f0b31))
* повторная попытка подключения pritunl ([deee54f](https://github.com/sarakusha/gmib/commit/deee54f2d387cd558ebcf0a5dceb69d9dc58bd25))
* скрыты несколько символов ключа ([e3ac7c2](https://github.com/sarakusha/gmib/commit/e3ac7c24cd9dfc899c8700cfff38a1a98c7c8415))
* сохраняет z-order при показе всех окон ([f4f3257](https://github.com/sarakusha/gmib/commit/f4f32575d2d725e13c78f1e80fad1f85362e5f7d))


### Bug Fixes

* не создавалась копия плейлиста ([3d75a16](https://github.com/sarakusha/gmib/commit/3d75a164883ddf6222f95a2412f7477f562764c9))
* невидимый элемент при перетаскивании ([5f3688e](https://github.com/sarakusha/gmib/commit/5f3688e0d8f9a3c773c4483188099658bdf9117e))

## [4.7.3](https://github.com/sarakusha/gmib/compare/v4.7.2...v4.7.3) (2023-11-22)


### Features

* 25fps ([a2d2c99](https://github.com/sarakusha/gmib/commit/a2d2c992acc696638a22c9a0481a0435ed931657))
* затухание между одинаковыми ([ab9dfb5](https://github.com/sarakusha/gmib/commit/ab9dfb5613ec1ecca2d260c1b57090994146b9aa))
* обновление меню плеер ([3fbec0b](https://github.com/sarakusha/gmib/commit/3fbec0bae32dff62acfacc84cb7b048e8bc2340b))
* обновление плееров ([fdacc43](https://github.com/sarakusha/gmib/commit/fdacc4320201058f41d30b7ce6158a476bad2b29))
* Подробное сообщение об ошибке ([d32491c](https://github.com/sarakusha/gmib/commit/d32491c7371b924d682190b48f046f40c459c5bd))
* текущий плейлист ([ab403b7](https://github.com/sarakusha/gmib/commit/ab403b786d3f41f3c25ea56c8b6ea46d174202c6))


### Bug Fixes

* очистить плеер ([c2dced8](https://github.com/sarakusha/gmib/commit/c2dced8d43ee229504ec31e8a2b50db0e62f2255))
* поля в таблице sensors ([2d8ec32](https://github.com/sarakusha/gmib/commit/2d8ec32bde576848e51dd10c240bd2e9f5860d6f))

## [4.7.2](https://github.com/sarakusha/gmib/compare/v4.7.1...v4.7.2) (2023-11-17)


### Features

* валидность параметров экрана ([8edec12](https://github.com/sarakusha/gmib/commit/8edec1231bc24a60767c707d691729480ded5775))
* история яркости и освещенности ([85e538f](https://github.com/sarakusha/gmib/commit/85e538f4cdf2d121eeba065f80c17fa5ec16a4bd))
* один стиль вкладки свойства ([db11674](https://github.com/sarakusha/gmib/commit/db116746e5fa4068eaaab14a7558fbb17424d1be))


### Bug Fixes

* безусловная перезагрузка теста ([90a5064](https://github.com/sarakusha/gmib/commit/90a5064f54118d69726331063c6c991b09dccb26))
* единицы времени в таблице яркости ([d9fd204](https://github.com/sarakusha/gmib/commit/d9fd20486f14a2adae632ce659fb3bcf2d72c31a))
* ошибка в параметрах promsifyAll ([fa3760d](https://github.com/sarakusha/gmib/commit/fa3760d0d5a03519107d6f467804c1366a5c8f13))
* ошибка при отрисовке react ([816e1f9](https://github.com/sarakusha/gmib/commit/816e1f98c09ef3d1dfde85ca6954740d44dc3fdc))
* сброс состояния после закрытия ([8dd7c6a](https://github.com/sarakusha/gmib/commit/8dd7c6a74341d3d2e9bf20ededb9e0917a94d270))

## [4.7.1](https://github.com/sarakusha/gmib/compare/v4.7.0...v4.7.1) (2023-11-14)


### Features

* корректный рестарт в режиме отладки ([c6def60](https://github.com/sarakusha/gmib/commit/c6def60e37ab20b05c683cdf196dd890e0ed1abb))
* синхронизация по сокету ([d0b7d66](https://github.com/sarakusha/gmib/commit/d0b7d663f52dbd6061c9d795d5650d293ad57bd9))
* ссылка на все версии ([fd1b7f6](https://github.com/sarakusha/gmib/commit/fd1b7f63669c1d39cb98f0ef9e50d1971b0fe9ec))
* playlist.current всегда валидный ([a938c6a](https://github.com/sarakusha/gmib/commit/a938c6a53645f4e88432d5e6dbc14d060c26d23c))
* transmitting duration along with position ([3e698f6](https://github.com/sarakusha/gmib/commit/3e698f6faea7b8c47d416c5bb0ab62733a8a684b))


### Bug Fixes

* валидация пустых строк ([0ecc8ef](https://github.com/sarakusha/gmib/commit/0ecc8ef8d3d5123555127cdce238ebc30037de5e))
* изменение плейлиста ([2216efa](https://github.com/sarakusha/gmib/commit/2216efa48a0eae44701b02ddd362006a04441fb9))
* исправлен режим перезапуска ([4544e32](https://github.com/sarakusha/gmib/commit/4544e327d8ca68b7adeea9c472253f8ab22266bd))
* не сохранялась телеметрия ([b741920](https://github.com/sarakusha/gmib/commit/b741920647f1b6304348517a1b09b964452acdc5))
* некорректная очередность проигрывания ([cfdd8e5](https://github.com/sarakusha/gmib/commit/cfdd8e56464d7d0a6d4de0688d2816dc261371b7))
* первое подключение ([9647353](https://github.com/sarakusha/gmib/commit/9647353aafe88d5be98c7a487079f01e3103b9be))
* пропущен коммит транзакции ([8bc63a0](https://github.com/sarakusha/gmib/commit/8bc63a084c8d1d09ce095173714a210701017359))
* пропущена запятая ([d954e8f](https://github.com/sarakusha/gmib/commit/d954e8f4497f386901ba6ff47af81082611fff14))
* синхронизация плейлиста ([abb3b85](https://github.com/sarakusha/gmib/commit/abb3b851cc1df6b21e68ee3952ae89cd81d90e4c))
* only remote ([6965f64](https://github.com/sarakusha/gmib/commit/6965f64f6233c9896e447d68c674f7fc755d02c6))

## [4.7.0](https://github.com/sarakusha/gmib/compare/v4.6.8...v4.7.0) (2023-10-31)


### Features

* cursor hidden ([3383ee3](https://github.com/sarakusha/gmib/commit/3383ee30567ff5f36d9f2af24de6143abfeecab7))
* high quality for video conversion ([3047c00](https://github.com/sarakusha/gmib/commit/3047c0057b12fa70bed53efb15bcd44143df15c8))
* prevent main window from closing when player is active ([9dbf0c3](https://github.com/sarakusha/gmib/commit/9dbf0c3eb86056c0f9813c833d78ebf034daca8b))


### Bug Fixes

* allow reboots when updating ([8d0cda5](https://github.com/sarakusha/gmib/commit/8d0cda5518239c893887c23720f97634761f603c))
* black screen ([351615a](https://github.com/sarakusha/gmib/commit/351615a2daf845d7a65f12b6d7f218dbc89c1c6e))
* close on error ([fe5ddcc](https://github.com/sarakusha/gmib/commit/fe5ddcc46cd843a3fbbbdb6b822a9bba8674bf11))
* debounced update ([5f5819c](https://github.com/sarakusha/gmib/commit/5f5819cdbbad62a6f7cda4d81f81d85d0f58d6b3))
* empty ip ([5e0dddd](https://github.com/sarakusha/gmib/commit/5e0dddd41844f3ed756e566b821398260b65ab62))
* exit app ([6f90475](https://github.com/sarakusha/gmib/commit/6f904759efd25727df9294df240400ad8f401994))
* gradual loading of content ([e06d489](https://github.com/sarakusha/gmib/commit/e06d4892c8bfa0aef5f651d6ac28036fe90de800))
* invisible cursor for HTML pages ([9cf710f](https://github.com/sarakusha/gmib/commit/9cf710f1d0bf94b9ba8b9c90396c706fe462e8bd))
* missed await ([2234420](https://github.com/sarakusha/gmib/commit/22344208f9c93cb0b37b2229ad0afa5ed7c63697))
* modified an invariant object ([ebcbdaf](https://github.com/sarakusha/gmib/commit/ebcbdafc9f9d4fb35e863a09ee85f003455a4f53))
* update current playlist ([d7eea36](https://github.com/sarakusha/gmib/commit/d7eea36a36c85851a2e0d9f1e15cbd094596042c))
* update player ([789400c](https://github.com/sarakusha/gmib/commit/789400c25aa9dd83a1c0b7e56153fc6f5b4a80d5))

## [4.6.8](https://github.com/sarakusha/gmib/compare/v4.6.7...v4.6.8) (2023-10-25)


### Features

* remote player state ([ef57b45](https://github.com/sarakusha/gmib/commit/ef57b45866155b632c10797d740913ee5c801cf4))
* remote relaunch ([781a637](https://github.com/sarakusha/gmib/commit/781a637ccbe5eafc05af96ef0f40cd18bfb5429d))
* restoring connection with a remote player ([f6c675b](https://github.com/sarakusha/gmib/commit/f6c675b39319b37dc1b412df0151ffefdcb57e48))
* upgrade menu ([ed62376](https://github.com/sarakusha/gmib/commit/ed6237659144438c5030169668bfa5a0dced7902))


### Bug Fixes

* the list of allowed codecs has been reduced ([bcb532c](https://github.com/sarakusha/gmib/commit/bcb532c7d0df0cf21fd6a91f4a2cada8861d43b8))

## [4.6.7](https://github.com/sarakusha/gmib/compare/v4.6.5...v4.6.7) (2023-10-17)


### Features

* added configuration without ffmpeg ([986c6fd](https://github.com/sarakusha/gmib/commit/986c6fd177e2df43f3201245b4489fec0bbc26c9))
* run system ffmpeg if not available ([b009451](https://github.com/sarakusha/gmib/commit/b009451ccabaa6ce49bd310b28b79bea44ac1f8f))


### Bug Fixes

* disable remote knocking ([db416fb](https://github.com/sarakusha/gmib/commit/db416fb2478db723d74dafa7750ca5c0ce06e0f1))
* enable relaunch on clean-exit ([f4dc86b](https://github.com/sarakusha/gmib/commit/f4dc86bdc123a8190aa9e22731fec1c2bce93697))
* relaunch after upgrade pages ([ed41e88](https://github.com/sarakusha/gmib/commit/ed41e88dece0f8460b514ab52f3557054ac2800a))

## [4.6.6](https://github.com/sarakusha/gmib/compare/v4.6.5...v4.6.6) (2023-10-13)


### Bug Fixes

* disable remote knocking ([db416fb](https://github.com/sarakusha/gmib/commit/db416fb2478db723d74dafa7750ca5c0ce06e0f1))
* relaunch after upgrade pages ([ed41e88](https://github.com/sarakusha/gmib/commit/ed41e88dece0f8460b514ab52f3557054ac2800a))

## [4.6.5](https://github.com/sarakusha/gmib/compare/v4.6.4...v4.6.5) (2023-10-10)


### Features

* hide the player menu for remote sessions ([ddd7244](https://github.com/sarakusha/gmib/commit/ddd72441850d91a20ab9bcff7db0b3b7edbac164))
* manually revalidate media ([f417e07](https://github.com/sarakusha/gmib/commit/f417e07f3785c3cb299301ad947c13f054b8b987))
* speed up transcoding at the expense of quality ([7caf77b](https://github.com/sarakusha/gmib/commit/7caf77b3ab6dc36f1cb3a78536fa3dcd17b3eaa4))


### Bug Fixes

* convert video to a supported codec format ([2b42abb](https://github.com/sarakusha/gmib/commit/2b42abbb24073f499ae5a381c7793559c5cd81e8))

## [4.6.4](https://github.com/sarakusha/gmib/compare/v4.6.3...v4.6.4) (2023-10-05)


### Features

* added knocking ([404434e](https://github.com/sarakusha/gmib/commit/404434ea389c66e0f145049855320a859f941f74))

## [4.6.3](https://github.com/sarakusha/gmib/compare/v4.6.2...v4.6.3) (2023-09-22)


### Features

* migrate from sse to websocket ([7843043](https://github.com/sarakusha/gmib/commit/7843043147ba65c0192993b0278afe3511b9e640))

## [4.6.2](https://github.com/sarakusha/gmib/compare/v4.6.1...v4.6.2) (2023-09-22)

## [4.6.1](https://github.com/sarakusha/gmib/compare/v4.6.0...v4.6.1) (2023-09-22)


### Features

* remote start novastar telemetry ([fcbfed0](https://github.com/sarakusha/gmib/commit/fcbfed0ad18ec7c0fcc7da35f633fbb7d5ef6d11))


### Bug Fixes

* unlimited license period ([d32a45c](https://github.com/sarakusha/gmib/commit/d32a45c27c940ebc87beb4650d38ab17eee1fc99))

## [4.6.0](https://github.com/sarakusha/gmib/compare/v4.5.1...v4.6.0) (2023-09-21)


### Features

* migration from previous configuration ([e07a117](https://github.com/sarakusha/gmib/commit/e07a11700c3fbb8df2e9b46956dc56c4d095f392))


### Bug Fixes

* remove depricated page ([0e9bf60](https://github.com/sarakusha/gmib/commit/0e9bf60794792e0ddafd659bbc8844448b2bb227))

## [4.5.1](https://github.com/sarakusha/gmib/compare/v4.5.0...v4.5.1) (2023-09-18)

## [4.5.0](https://github.com/sarakusha/gmib/compare/v4.4.0...v4.5.0) (2023-09-15)


### Features

* added pritunl-client support ([81ee78b](https://github.com/sarakusha/gmib/commit/81ee78b5dbd3b00deec54abeb7ed965674fe2fcb))
* added remote hostname ([92d05f2](https://github.com/sarakusha/gmib/commit/92d05f2d55991eb63fd1e322994449a1bf072619))


### Bug Fixes

* announce fixed ([dfa9662](https://github.com/sarakusha/gmib/commit/dfa966223107052870a52468034e7244828e2d20))
* fixed remote connection to novastar ([6133340](https://github.com/sarakusha/gmib/commit/6133340f9d1e789f70680ec7e0b77fa55eaf2a01))

## [4.4.0](https://github.com/sarakusha/gmib/compare/v4.2.1...v4.4.0) (2023-08-29)


### Features

* added licensing ([0b0f6ca](https://github.com/sarakusha/gmib/commit/0b0f6ca79291b46b2494ba05308900a79bc13884))
* shows the current version for remote sessions ([5387a2f](https://github.com/sarakusha/gmib/commit/5387a2fa12068e18d5d3364a12f3051542f9946d))
* transferring pages from a configuration file to a database ([5fcd01f](https://github.com/sarakusha/gmib/commit/5fcd01f8c3ffd3be4b1d51288b5a2ab8c4d6bde0))


### Bug Fixes

* API call error handling ([ed2c93e](https://github.com/sarakusha/gmib/commit/ed2c93e85ebdcea44dcd087b0b94d103bb9abe73))
* bug fix ([b03414a](https://github.com/sarakusha/gmib/commit/b03414aa995302a927b3bc2af2d8fadd051c5ebb))

## [4.2.1](https://github.com/sarakusha/gmib/compare/v4.2.0...v4.2.1) (2023-06-21)


### Bug Fixes

* CSP changed after electron update ([10bed67](https://github.com/sarakusha/gmib/commit/10bed6708db029a98fe8edd1bd497ff6d3b8d634))
* deadlock at application startup if there are already running applications on the network ([8b9e76d](https://github.com/sarakusha/gmib/commit/8b9e76d49f5b598e4957244c1e29ca2ca13bb297))

## [4.2.0](https://github.com/sarakusha/gmib/compare/v4.1.0...v4.2.0) (2023-06-08)


### Features

* code improvement ([5e076c8](https://github.com/sarakusha/gmib/commit/5e076c87a119aaed9510b5e62c707107f2ed1753))
* cross-origin enabled ([0b9eb91](https://github.com/sarakusha/gmib/commit/0b9eb9188a5578cfde1e414c0014681073d4a500))
* get url for the remote session ([5cfd833](https://github.com/sarakusha/gmib/commit/5cfd83301c63a094629ee2f45207a1aac5285ce1))
* remote credentials ([24455ad](https://github.com/sarakusha/gmib/commit/24455ad83d146d3f9e02233ac12d35d843e7d38c))
* unsafeMode ([d3bc09b](https://github.com/sarakusha/gmib/commit/d3bc09bf78f72c9d7725e4419892246caad4d4f0))
* update restrictions ([d81c69f](https://github.com/sarakusha/gmib/commit/d81c69ff3fcfabc157da44a3376e2996b4f1acad))


### Bug Fixes

* iput ([05209b2](https://github.com/sarakusha/gmib/commit/05209b2c234bd1fdac70006066a87d8d5056f1f1))
* remote auth ([8d1b12c](https://github.com/sarakusha/gmib/commit/8d1b12c55dccb1be273f9de8a5d2b7a3f1dab2ea))
* typo ([d139b4f](https://github.com/sarakusha/gmib/commit/d139b4ff6b1b015ee7eb928a82a4b7114195821f))
* uncaughtException ([0ea0fa5](https://github.com/sarakusha/gmib/commit/0ea0fa523b46139cdff2d13a72fbbbcda464ef93))
* WebRTC negotiation ([5d8b933](https://github.com/sarakusha/gmib/commit/5d8b9334d43edd9ca79ed48a0623794c8704b410))
* WebRTC negotiation ([ebc2d92](https://github.com/sarakusha/gmib/commit/ebc2d92a546a734387c65b389d28782b3ee7981d))

## [4.0.0](https://github.com/sarakusha/gmib/compare/v3.6.6...v4.0.0) (2022-11-02)

## [4.1.0](https://github.com/sarakusha/gmib/compare/v3.6.6...v4.1.0) (2023-03-07)


### Features

* access to machineid for renderer ([507f623](https://github.com/sarakusha/gmib/commit/507f623e9e508628cc39e32609dd0c5e18d462bb))
* added custom and machineid useragent. ([501c0cf](https://github.com/sarakusha/gmib/commit/501c0cfaf61984587a3312acc40eb7049675ecf6))
* fixed output set ([5772c8c](https://github.com/sarakusha/gmib/commit/5772c8cbc3b965c2d26e62b6f9b8d6753a238ac6))
* manual update ([20ad441](https://github.com/sarakusha/gmib/commit/20ad4416d19ce90315d43370c7c9328b95ccc12e))
* option to disable network search for novastar devices ([c1f735a](https://github.com/sarakusha/gmib/commit/c1f735abc362a7b0e74f787dcec7cbaa5e75a19e))
* set autoUpdate log ([552b1b0](https://github.com/sarakusha/gmib/commit/552b1b0acda98252e50a7b3037caa3516365b274))
* wildcard parameter "resources" ([19c05e0](https://github.com/sarakusha/gmib/commit/19c05e088a773bdb20d713291fb6cfa2d9cf01ca))


### Bug Fixes

* c22 recognition ([626f506](https://github.com/sarakusha/gmib/commit/626f50628e3144a5773476c78c0178b31ea0307f))
* catch an error ([6c1e94e](https://github.com/sarakusha/gmib/commit/6c1e94e4983e38fce087a27467665f2c658c099a))
* catch an error ([9a7331b](https://github.com/sarakusha/gmib/commit/9a7331bb4648d1e50e0a0e7e3f457faf88287a0c))
* catch an error ([061bd56](https://github.com/sarakusha/gmib/commit/061bd56511336344b3cd10b24ed41e160215a16b))
* disable preload sandbox after upgrade electron ([133e4f1](https://github.com/sarakusha/gmib/commit/133e4f141ffc80603605c548eab9db012ceb1f38))
* icons visibility ([7082d9a](https://github.com/sarakusha/gmib/commit/7082d9aa96d5ff6db938c26e527719409dc61ffd))
* nested default ([d8f652b](https://github.com/sarakusha/gmib/commit/d8f652bf00bffdbabeeadb2e93828e76be0bcaaa))
* popup ([d15cbce](https://github.com/sarakusha/gmib/commit/d15cbce0216836e11aa6c4f3e7c5d1aea9e3c366))
* relaunch for AppImage ([88a6e4d](https://github.com/sarakusha/gmib/commit/88a6e4d71b11f6df6536dccbd3b893dc48d2da7d))

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
