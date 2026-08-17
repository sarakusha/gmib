import Highcharts from 'highcharts/es-modules/masters/highcharts.src.js';
import 'highcharts/es-modules/masters/highcharts-more.src.js';
import 'highcharts/es-modules/masters/modules/solid-gauge.src.js';

export type * from 'highcharts/highcharts.src';

Highcharts.setOptions({
  colors: [
    '#2caffe',
    '#544fc5',
    '#00e272',
    '#fe6a35',
    '#6b8abc',
    '#d568fb',
    '#2ee0ca',
    '#fa4b42',
    '#feb56a',
    '#91e8e1',
  ],
  chart: {
    // Keep the v12.6 appearance rather than relying on the v13 CSS palette.
    borderColor: '#334eff',
    backgroundColor: '#fff',
    plotBorderColor: '#ccc',
  },
  title: {
    style: {
      color: '#333',
    },
  },
  xAxis: {
    gridLineColor: '#e6e6e6',
    lineColor: '#333',
    tickColor: '#333',
    labels: { style: { color: '#333' } },
    title: { style: { color: '#666' } },
  },
  yAxis: {
    gridLineColor: '#e6e6e6',
    lineColor: '#333',
    tickColor: '#333',
    labels: { style: { color: '#333' } },
    title: { style: { color: '#666' } },
  },
  legend: {
    borderColor: '#999',
    itemStyle: { color: '#333' },
    itemHoverStyle: { color: '#000' },
    itemHiddenStyle: { color: '#666' },
    title: { style: { color: '#333' } },
  },
  tooltip: {
    backgroundColor: '#fff',
    style: { color: '#333' },
  },
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
  accessibility: {
    enabled: false,
  },
});

export default Highcharts;
