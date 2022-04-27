/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Highcharts from 'highcharts';
import highchartsMore from 'highcharts/highcharts-more';
import highchartsSolidGauge from 'highcharts/modules/solid-gauge';

export * from 'highcharts';

highchartsMore(Highcharts);
highchartsSolidGauge(Highcharts);

Highcharts.setOptions({
  lang: {
    months: [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ],
    shortMonths: [
      'Янв',
      'Фев',
      'Мар',
      'Апр',
      'Май',
      'Июн',
      'Июл',
      'Авг',
      'Сен',
      'Окт',
      'Ноя',
      'Дек',
    ],
    weekdays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    resetZoom: 'Сутки',
    resetZoomTitle: 'Сбросить масштаб до суток',
  },
});

export default Highcharts;
