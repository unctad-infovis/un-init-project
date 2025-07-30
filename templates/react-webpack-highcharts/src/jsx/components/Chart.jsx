import React, {
  forwardRef, useEffect, useCallback, useRef
} from 'react';
import PropTypes from 'prop-types';

// https://www.highcharts.com/

import Highcharts from 'highcharts';
import 'highcharts/modules/accessibility';

// https://www.npmjs.com/package/react-is-visible
import 'intersection-observer';
import { useIsVisible } from 'react-is-visible';

// Load helpers.
// import roundNr from '../helpers/RoundNr.js';
// import formatNr from '../helpers/FormatNr.js';

Highcharts.setOptions({
  lang: {
    decimalPoint: '.',
    downloadCSV: 'Download CSV data',
    thousandsSep: ' '
  }
});
Highcharts.SVGRenderer.prototype.symbols.download = (x, y, w, h) => {
  const path = ['M', x + w * 0.5, y, 'L', x + w * 0.5, y + h * 0.7, 'M', x + w * 0.3, y + h * 0.5, 'L', x + w * 0.5, y + h * 0.7, 'L', x + w * 0.7, y + h * 0.5, 'M', x, y + h * 0.9, 'L', x, y + h, 'L', x + w, y + h, 'L', x + w, y + h * 0.9];
  return path;
};

const LineChart = forwardRef((props, ref) => {
  const chartRef = useRef();
  const isVisible = useIsVisible(chartRef, { once: true });

  const createChart = useCallback(() => {
    ref.current = Highcharts.chart(`chartIdx${props.idx}`, {
      caption: {
        align: 'left',
        margin: 15,
        style: {
          color: 'rgba(0, 0.0, 0.0, 0.8)',
          fontSize: '13px'
        },
        text: '<em>Source:</em> UN Trade and Development (UNCTAD) based on FAO Cereals Price Index and FAOSTAT.<br/><em>Note:</em> The data for the “prevalence of undernourishment” indicator is available until 2024. Cereal price index for 2025: January – July 2025.',
        useHTML: true,
        verticalAlign: 'bottom',
        x: 0
      },
      chart: {
        backgroundColor: '#f4f9fd',
        height: 500,
        style: {
          color: '#fff',
          fontFamily: 'Inter',
          fontWeight: 400
        },
        type: 'line'
      },
      credits: {
        enabled: false
      },
      legend: {
        align: 'left',
        alignColumns: false,
        enabled: true,
        events: {
          itemClick() {
            return false;
          }
        },
        itemHoverStyle: {
          color: '#000'
        },
        itemDistance: 30,
        itemStyle: {
          cursor: 'default',
          fontSize: '15px',
          fontWeight: 400
        },
        margin: 30,
        verticalAlign: 'top'
      },
      plotOptions: {
        series: {
          pointStart: 2000
        },
        line: {
          allowPointSelect: false,
          animation: {
            duration: 500
          },
          cursor: 'pointer',
          dataLabels: {
            enabled: false
          },
          enableMouseTracking: true,
          lineWidth: 5,
          marker: {
            enabled: false,
            states: {
              hover: {
                enabled: false
              },
              select: {
                enabled: false
              }
            }
          }
        },
        column: {
          allowPointSelect: false,
          animation: {
            duration: 500
          },
          cursor: 'pointer',
          dataLabels: {
            enabled: false
          },
          enableMouseTracking: true,
          groupPadding: 0,
          states: {
            hover: {
              enabled: false
            }
          }
        }
      },
      series: [
        {
          color: '#009edb',
          data: props.data[0]['Cereals Price Index'],
          name: 'Cereals Price Index',
          type: 'column',
          yAxis: 0
        },
        {
          color: '#ffcb05',
          data: props.data[0]['Prevalence of undernourishment'],
          name: 'Prevalence of undernourishment',
          type: 'line',
          yAxis: 1
        }
      ],
      subtitle: {
        enabled: false
      },
      title: {
        text: undefined
      },
      tooltip: {
        headerFormat: '<span style="font-size: 18px;"><strong>{point.x}</strong></span><br />',
        shared: true,
        style: {
          color: '#000',
          fontFamily: 'Inter',
          fontSize: '15px'
        }
      },
      xAxis: {
        crosshair: {
          color: 'transparent',
          width: 1
        },
        labels: {
          distance: 10,
          padding: 0,
          rotation: 0,
          style: {
            color: '#000',
            fontFamily: 'Inter',
            fontSize: '14px',
            fontWeight: 400
          }
        },
        lineColor: 'transparent',
        lineWidth: 0,
        opposite: false,
        plotLines: null,
        reserveSpace: false,
        showFirstLabel: true,
        showLastLabel: true,
        tickWidth: 0,
        title: {
          enabled: false
        }
      },
      yAxis: [{
        allowDecimals: true,
        gridLineColor: '#555',
        gridLineWidth: 0,
        min: 0,
        max: 160,
        gridLineDashStyle: 'shortdot',
        labels: {
          rotation: 0,
          style: {
            color: '#000',
            fontFamily: 'Inter',
            fontSize: '14px',
            fontWeight: 400
          }
        },
        endOnTick: false,
        lineColor: 'transparent',
        lineWidth: 0,
        showFirstLabel: true,
        showLastLabel: true,
        startOnTick: false,
        tickInterval: 20,
        title: {
          align: 'high',
          enabled: false,
          offset: 0,
          reserveSpace: false,
          rotation: 0,
          style: {
            color: '#000',
            fontFamily: 'Inter',
            fontSize: '16px',
            fontWeight: 600
          },
          text: '',
          x: 115,
          y: 5
        },
        type: 'linear'
      }, {
        allowDecimals: true,
        gridLineColor: '#555',
        gridLineWidth: 1,
        gridLineDashStyle: 'shortdot',
        labels: {
          rotation: 0,
          style: {
            color: '#000',
            fontFamily: 'Inter',
            fontSize: '14px',
            fontWeight: 400
          }
        },
        endOnTick: false,
        lineColor: 'transparent',
        lineWidth: 0,
        min: 0,
        max: 14,
        opposite: true,
        showFirstLabel: true,
        showLastLabel: true,
        startOnTick: false,
        tickInterval: 2,
        title: {
          align: 'high',
          enabled: true,
          offset: 0,
          reserveSpace: false,
          rotation: 0,
          style: {
            color: '#000',
            fontFamily: 'Inter',
            fontSize: '15px',
            fontWeight: 500
          },
          text: '%',
          x: -15,
          y: -15
        },
        type: 'linear'
      }]
    });
    chartRef.current.querySelector(`#chartIdx${props.idx}`).style.opacity = 1;
    return () => {
      if (ref.current) {
        ref.current.destroy(); // Cleanup on unmount
        ref.current = null;
      }
    };
  }, [ref, props.idx, props.data]);

  useEffect(() => {
    if (isVisible === true) {
      setTimeout(() => {
        createChart();
      }, 300);
    }
  }, [createChart, isVisible]);

  return (
    <div className="chart_container">
      <div ref={chartRef}>
        {(isVisible) && (<div className="chart" id={`chartIdx${props.idx}`} />)}
      </div>
      <noscript>Your browser does not support JavaScript!</noscript>
    </div>
  );
});

export default LineChart;

LineChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array
  ])).isRequired,
  idx: PropTypes.string.isRequired
};
