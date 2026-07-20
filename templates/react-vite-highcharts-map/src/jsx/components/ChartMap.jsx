import Highcharts from 'highcharts';

import { useCallback, useEffect, useMemo, useRef } from 'react';

// https://www.highcharts.com/
import 'highcharts/modules/accessibility';
import 'highcharts/modules/exporting';
import 'highcharts/modules/export-data';
import 'highcharts/modules/map';
import 'highcharts/modules/pattern-fill';

// Load map helpers.
import createMaplineSeries from '@unctad-infovis/map-tools/CreateMaplineSeries.js';
import getColor from '@unctad-infovis/map-tools/GetColor.js';
import getValue from '@unctad-infovis/map-tools/GetValue.js';
import processTopoObject from '@unctad-infovis/map-tools/ProcessTopoObject.js';
import processTopoObjectPolygons from '@unctad-infovis/map-tools/ProcessTopoObjectPolygons.js';

import './ChartMap.css';

function ChartMap({ data }) {
  const chartMapRef = useRef(null);
  const chartMapContainerRef = useRef(null);
  const chinaAreas = useMemo(() => ['156', '158', '344', '446'], []);

  const createMap = useCallback(
    (map_data, topology) => {
      // Prepare a mapping of code -> labelen, labelfr from topology
      const labelMap = topology.objects.economies.geometries.reduce((mapLabel, geometry) => {
        const { code, labelen, labelfr } = geometry.properties; // Extract properties from geometry
        mapLabel[code] = { labelen, labelfr }; // Map code to labelen and labelfr
        return mapLabel;
      }, {});
      // Manually insert European Union label
      labelMap['918'] = {
        labelen: 'European Union',
        labelfr: 'Union européenne'
      };

      Highcharts.setOptions({
        lang: {
          decimalPoint: '.',
          downloadCSV: 'Download CSV data',
          thousandsSep: ' '
        }
      });
      Highcharts.SVGRenderer.prototype.symbols.download = (x, y, w, h) => {
        const path = [
          // Arrow stem
          'M',
          x + w * 0.5,
          y,
          'L',
          x + w * 0.5,
          y + h * 0.7,
          // Arrow head
          'M',
          x + w * 0.3,
          y + h * 0.5,
          'L',
          x + w * 0.5,
          y + h * 0.7,
          'L',
          x + w * 0.7,
          y + h * 0.5,
          // Box
          'M',
          x,
          y + h * 0.9,
          'L',
          x,
          y + h,
          'L',
          x + w,
          y + h,
          'L',
          x + w,
          y + h * 0.9
        ];
        return path;
      };
      if (!chartMapContainerRef?.current) return;
      chartMapRef.current = Highcharts.mapChart(chartMapContainerRef.current, {
        caption: {
          enabled: false
        },
        chart: {
          backgroundColor: 'transparent',
          height: Math.max((chartMapContainerRef.current.offsetWidth * 7) / 16, 450),
          type: 'map'
        },
        credits: {
          enabled: false
        },
        exporting: {
          buttons: {
            contextButton: {
              menuItems: ['viewFullscreen', 'separator', 'downloadPNG', 'downloadPDF', 'separator', 'downloadCSV'],
              symbol: 'download',
              symbolFill: '#000',
              y: 10
            }
          },
          enabled: false,
          filename: 'export'
        },
        legend: {
          enabled: true,
          floating: true,
          events: {
            itemClick() {
              return false;
            }
          },
          itemStyle: {
            color: '#222',
            cursor: 'default'
          },
          itemHoverStyle: {
            color: '#222',
            cursor: 'default'
          }
        },
        colorAxis: {
          dataClasses: [
            {
              color: '#fbaf17',
              from: 0.5,
              name: 'Country group 1',
              to: 1.5
            },
            {
              color: '#009edb',
              from: 1.5,
              name: 'Country group 2',
              to: 2.5
            }
          ]
        },
        mapNavigation: {
          buttonOptions: {
            x: 0,
            verticalAlign: 'bottom'
          },
          enableButtons: true,
          enabled: false
        },
        plotOptions: {
          mapline: {
            lineWidth: 0.33,
            tooltip: {
              enabled: false
            }
          },
          series: {
            point: {
              events: {}
            }
          }
        },
        responsive: {
          rules: [
            {
              chartOptions: {
                title: {
                  style: {
                    fontSize: '26px',
                    lineHeight: '30px'
                  }
                },
                exporting: {
                  enabled: false
                }
              },
              condition: {
                maxWidth: 500
              }
            }
          ]
        },
        series: [
          {
            // The colored layer series.
            affectsMapView: true,
            mapData: processTopoObjectPolygons(topology, 'economies-color'),
            data: topology.objects.economies.geometries.map(region => {
              const { code, labelen } = region.properties;
              const match = map_data.find(row => row.code === code);
              region.properties.value = match ? match.value : null;
              return {
                borderWidth: 0,
                code,
                color: getColor(region.properties, map_data, chinaAreas),
                events: {
                  click() {
                    console.log('asd');
                    return true;
                  },
                  mouseOver() {
                    if (this.id === 'C00003') {
                      return false;
                    }
                    if (chinaAreas.includes(this.id)) {
                      const { chart } = this.series;
                      chinaAreas.forEach(area => {
                        chart.get(area)?.setState('hover');
                      });
                    }
                    return true;
                  },
                  mouseOut: () => {
                    const { chart } = chartMapRef.current.series[0];
                    chinaAreas.forEach(area => {
                      chart.get(area)?.setState('');
                    });
                  }
                },
                id: code,
                name: labelen,
                value: getValue(region.properties, map_data, chinaAreas)
              };
            }),
            enableMouseTracking: true,
            joinBy: ['code', 'code'],
            name: 'economies_color',
            nullColor: '#ded9d5',
            states: {
              hover: {
                borderColor: '#fff',
                borderWidth: 2
              },
              inactive: {
                enabled: false
              }
            },
            type: 'map',
            visible: true
          },
          // Using the function to create mapline series
          createMaplineSeries('dash_borders', processTopoObject(topology, 'dashed-borders'), 'Dash'),
          createMaplineSeries('dot_borders', processTopoObject(topology, 'dotted-borders'), 'Dot'),
          createMaplineSeries('dash_dot_borders', processTopoObject(topology, 'plain-borders'), 'DashDot'),
          createMaplineSeries('solid_borders', processTopoObject(topology, 'plain-borders'), 'Solid')
        ],
        subtitle: {
          text: null
        },
        tooltip: {
          useHTML: true,
          enabled: true,
          formatter() {
            return `
              <div class="map_tooltip">
                <h3>${this.name}</h3>
                <ul>
                  <li><span class="label">Value:</span> <span class="value">${this.value}</span></li>
                </ul>
              </div>
            `;
          },
          style: {
            color: '#000',
            fontFamily: 'Inter, Helvetica, Arial, sans-serif',
            fontSize: '13px',
            fontWeight: 300
          }
        },
        title: {
          text: null
        }
      });
      return () => {
        if (chartMapRef.current) {
          chartMapRef.current.destroy(); // Cleanup on unmount
          chartMapRef.current = null;
        }
      };
    },
    [chinaAreas]
  );

  useEffect(() => {
    if (!data.topology) return;
    const { map_data, topology } = data;

    // Extract the transformation values from the TopoJSON
    const { scale, translate } = topology.transform;

    // Extract and transform the point coordinates for 'economies-point'
    const coordinatesMap = topology.objects['economies-point'].geometries.reduce((mapCoordinates, geometry) => {
      const [x, y] = geometry.coordinates; // Original projected coordinates

      // Apply inverse transformation (reverse scaling and translation)
      const lon = x * scale[0] + translate[0];
      const lat = y * scale[1] + translate[1];

      const economyCode = geometry.properties.code;
      mapCoordinates[economyCode] = { lon, lat }; // Map code to coordinates
      return mapCoordinates;
    }, {});
    coordinatesMap['918'] = {
      lon: 69042 * scale[0] + translate[0],
      lat: 64101 * scale[1] + translate[1]
    };

    if (!chartMapRef.current?.renderTo) {
      createMap(map_data, topology);
    }
  }, [createMap, data]);

  return (
    <figure className="container_map">
      <div ref={chartMapContainerRef} />
    </figure>
  );
}

export default ChartMap;
