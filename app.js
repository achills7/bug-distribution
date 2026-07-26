const STORAGE_KEY = 'bugDistributionData';

const COLORS = {
  p0_unresolved: '#ff4d4f',
  p1_unresolved: '#ff7a45',
  p2_unresolved: '#faad14',
  p0_pending: '#1677ff',
  p1_pending: '#722ed1',
  p2_pending: '#13c2c2',
  total: '#52c41a'
};

const LABELS = {
  p0_unresolved: 'P0未解决',
  p1_unresolved: 'P1未解决',
  p2_unresolved: 'P2及以下未解决',
  p0_pending: 'P0待验证',
  p1_pending: 'P1待验证',
  p2_pending: 'P2及以下待验证'
};

const FIELD_KEYS = ['p0_unresolved', 'p1_unresolved', 'p2_unresolved', 'p0_pending', 'p1_pending', 'p2_pending'];

let bugData = [];
let barChart = null;
let softwarePieChart = null;
let firmwarePieChart = null;

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      bugData = JSON.parse(stored);
      bugData.sort((a, b) => a.date.localeCompare(b.date));
    }
  } catch (e) {
    console.error('加载数据失败:', e);
    bugData = [];
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bugData));
  } catch (e) {
    console.error('保存数据失败:', e);
    alert('保存数据失败，请检查浏览器存储设置');
  }
}

function getFormData() {
  const date = document.getElementById('dateInput').value;
  if (!date) return null;

  const software = {};
  const firmware = {};

  FIELD_KEYS.forEach(key => {
    software[key] = parseInt(document.getElementById('sw_' + key).value) || 0;
    firmware[key] = parseInt(document.getElementById('fw_' + key).value) || 0;
  });

  return { date, software, firmware };
}

function setFormInputValue(id, value) {
  var el = document.getElementById(id);
  if (value && value > 0) {
    el.value = value;
  } else {
    el.value = '';
  }
}

function setFormData(record) {
  if (!record) return;
  document.getElementById('dateInput').value = record.date;
  FIELD_KEYS.forEach(function(key) {
    setFormInputValue('sw_' + key, record.software[key]);
    setFormInputValue('fw_' + key, record.firmware[key]);
  });
}

function resetForm() {
  document.getElementById('dateInput').value = getTodayDate();
  FIELD_KEYS.forEach(function(key) {
    document.getElementById('sw_' + key).value = '';
    document.getElementById('fw_' + key).value = '';
  });
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addOrUpdateRecord(record) {
  const existingIndex = bugData.findIndex(r => r.date === record.date);
  if (existingIndex >= 0) {
    bugData[existingIndex] = record;
  } else {
    bugData.push(record);
  }
  bugData.sort((a, b) => a.date.localeCompare(b.date));
  saveData();
}

window.deleteRecord = function(date) {
  if (!confirm('确定要删除 ' + date + ' 的数据吗？')) return;
  bugData = bugData.filter(r => r.date !== date);
  saveData();
  renderAll();
};

function calculateTotal(record) {
  const swTotal = FIELD_KEYS.reduce((sum, key) => sum + (record.software[key] || 0), 0);
  const fwTotal = FIELD_KEYS.reduce((sum, key) => sum + (record.firmware[key] || 0), 0);
  return swTotal + fwTotal;
}

function calculateSoftwareTotal(record) {
  return FIELD_KEYS.reduce((sum, key) => sum + (record.software[key] || 0), 0);
}

function calculateFirmwareTotal(record) {
  return FIELD_KEYS.reduce((sum, key) => sum + (record.firmware[key] || 0), 0);
}

function updateTotalCount() {
  const totalEl = document.getElementById('totalCount');
  const dateEl = document.getElementById('totalDate');

  if (bugData.length === 0) {
    totalEl.textContent = '0';
    dateEl.textContent = '暂无数据';
    return;
  }

  const latest = bugData[bugData.length - 1];
  const total = calculateTotal(latest);
  totalEl.textContent = total.toLocaleString();
  dateEl.textContent = '数据日期：' + formatDate(latest.date);
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  return parts[0] + '/' + parts[1] + '/' + parts[2];
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function createCenterTextPlugin(totalValue, color) {
  return {
    id: 'centerText',
    afterDraw: function(chart) {
      try {
        const chartArea = chart.chartArea;
        const centerX = (chartArea.left + chartArea.right) / 2;
        const centerY = (chartArea.top + chartArea.bottom) / 2;
        const chartHeight = chartArea.bottom - chartArea.top;
        const ctx = chart.ctx;
        ctx.save();
        const baseFontSize = Math.max(14, chartHeight / 12);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold ' + (baseFontSize * 0.55) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText('总计', centerX, centerY - 2);
        ctx.fillStyle = color;
        ctx.font = 'bold ' + baseFontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(totalValue.toLocaleString(), centerX, centerY + 2);
        ctx.restore();
      } catch (e) {
        console.error('中心文字绘制失败:', e);
      }
    }
  };
}

function renderBarChart() {
  try {
    const ctx = document.getElementById('barChart').getContext('2d');
    var legendEl = document.getElementById('barChartLegend');

    if (barChart) {
      barChart.destroy();
      barChart = null;
    }

    if (bugData.length === 0) {
      if (legendEl) {
        legendEl.style.display = 'none';
      }
      return;
    }

    if (legendEl) {
      legendEl.style.display = 'block';
    }

    const dates = bugData.map(r => formatDate(r.date));
    const datasets = [];

    FIELD_KEYS.forEach(function(key) {
      datasets.push({
        label: '软件-' + LABELS[key],
        data: bugData.map(function(r) { return r.software[key] || 0; }),
        backgroundColor: COLORS[key],
        borderColor: COLORS[key],
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.9,
        categoryPercentage: 0.9
      });
    });

    FIELD_KEYS.forEach(function(key) {
      var alphaColor = hexToRgba(COLORS[key], 0.55);
      datasets.push({
        label: '固件-' + LABELS[key],
        data: bugData.map(function(r) { return r.firmware[key] || 0; }),
        backgroundColor: alphaColor,
        borderColor: COLORS[key],
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.9,
        categoryPercentage: 0.9
      });
    });

    const totalData = bugData.map(function(r) { return calculateTotal(r); });

    datasets.push({
      label: '未关闭BUG总数',
      data: totalData,
      type: 'line',
      borderColor: COLORS.total,
      backgroundColor: hexToRgba(COLORS.total, 0.1),
      borderWidth: 3,
      pointBackgroundColor: COLORS.total,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: true,
      yAxisID: 'y1',
      order: 0
    });

    barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 },
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 12 },
              color: '#6b7280'
            }
          },
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: { size: 12 },
              color: '#6b7280'
            },
            title: {
              display: true,
              text: '分类数量',
              font: { size: 12 },
              color: '#9ca3af'
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: {
              display: false
            },
            ticks: {
              font: { size: 12 },
              color: COLORS.total
            },
            title: {
              display: true,
              text: '未关闭BUG总数',
              font: { size: 12 },
              color: COLORS.total
            }
          }
        }
      }
    });

    renderBarChartLegend();
  } catch (e) {
    console.error('渲染簇状图失败:', e);
  }
}

function renderBarChartLegend() {
  if (!barChart) return;

  var swContainer = document.getElementById('softwareLegend');
  var fwContainer = document.getElementById('firmwareLegend');
  var totalContainer = document.getElementById('totalLegend');

  var swHtml = '';
  var fwHtml = '';
  var totalHtml = '';

  barChart.data.datasets.forEach(function(ds, index) {
    var meta = barChart.getDatasetMeta(index);
    var isHidden = meta.hidden;
    var color = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : ds.backgroundColor;
    var isLine = ds.type === 'line';

    var itemHtml = '<span class="legend-item ' + (isHidden ? 'inactive' : '') + '" data-index="' + index + '" onclick="toggleBarDataset(' + index + ')">' +
      '<span class="legend-color ' + (isLine ? 'line' : '') + '" style="background-color: ' + color + '; ' + (isLine ? 'color: ' + color + ';' : '') + '"></span>' +
      ds.label +
    '</span>';

    if (isLine) {
      totalHtml += itemHtml;
    } else if (ds.label.indexOf('软件-') === 0) {
      swHtml += itemHtml;
    } else if (ds.label.indexOf('固件-') === 0) {
      fwHtml += itemHtml;
    }
  });

  swContainer.innerHTML = swHtml;
  fwContainer.innerHTML = fwHtml;
  totalContainer.innerHTML = totalHtml;
}

window.toggleBarDataset = function(index) {
  if (!barChart) return;
  var meta = barChart.getDatasetMeta(index);
  meta.hidden = !meta.hidden;
  barChart.update('none');
  renderBarChartLegend();
};

function renderSoftwarePieChart() {
  try {
    const ctx = document.getElementById('softwarePieChart').getContext('2d');

    if (softwarePieChart) {
      softwarePieChart.destroy();
      softwarePieChart = null;
    }

    if (bugData.length === 0) {
      softwarePieChart = renderEmptyPie(ctx);
      return;
    }

    const latest = bugData[bugData.length - 1];
    const data = FIELD_KEYS.map(key => latest.software[key] || 0);
    const total = data.reduce((sum, v) => sum + v, 0);

    softwarePieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: FIELD_KEYS.map(function(k) { return LABELS[k]; }),
        datasets: [{
          data: data,
          backgroundColor: FIELD_KEYS.map(function(k) { return COLORS[k]; }),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 8,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'left',
            labels: {
              usePointStyle: true,
              pointStyle: 'rect',
              padding: 12,
              font: { size: 11 },
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function(label, i) {
                    const value = data.datasets[0].data[i];
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return {
                      text: label + ': ' + value + ' (' + percentage + '%)',
                      fillStyle: data.datasets[0].backgroundColor[i],
                      strokeStyle: data.datasets[0].backgroundColor[i],
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ' ' + context.label + ': ' + value + ' (' + percentage + '%)';
              }
            }
          }
        }
      },
      plugins: [createCenterTextPlugin(total, '#1677ff')]
    });
  } catch (e) {
    console.error('渲染软件饼图失败:', e);
  }
}

function renderFirmwarePieChart() {
  try {
    const ctx = document.getElementById('firmwarePieChart').getContext('2d');

    if (firmwarePieChart) {
      firmwarePieChart.destroy();
      firmwarePieChart = null;
    }

    if (bugData.length === 0) {
      firmwarePieChart = renderEmptyPie(ctx);
      return;
    }

    const latest = bugData[bugData.length - 1];
    const data = FIELD_KEYS.map(key => latest.firmware[key] || 0);
    const total = data.reduce((sum, v) => sum + v, 0);

    firmwarePieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: FIELD_KEYS.map(function(k) { return LABELS[k]; }),
        datasets: [{
          data: data,
          backgroundColor: FIELD_KEYS.map(function(k) { return COLORS[k]; }),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 8,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'left',
            labels: {
              usePointStyle: true,
              pointStyle: 'rect',
              padding: 12,
              font: { size: 11 },
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function(label, i) {
                    const value = data.datasets[0].data[i];
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return {
                      text: label + ': ' + value + ' (' + percentage + '%)',
                      fillStyle: data.datasets[0].backgroundColor[i],
                      strokeStyle: data.datasets[0].backgroundColor[i],
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ' ' + context.label + ': ' + value + ' (' + percentage + '%)';
              }
            }
          }
        }
      },
      plugins: [createCenterTextPlugin(total, '#722ed1')]
    });
  } catch (e) {
    console.error('渲染固件饼图失败:', e);
  }
}

function renderEmptyPie(ctx) {
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['暂无数据'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e5e7eb'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    },
    plugins: [{
      id: 'emptyText',
      afterDraw: function(chart) {
        try {
          const width = chart.width;
          const height = chart.height;
          const ctx = chart.ctx;
          ctx.save();
          ctx.font = '14px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#9ca3af';
          ctx.fillText('暂无数据', width / 2, height / 2);
          ctx.restore();
        } catch (e) {
          console.error('空状态文字绘制失败:', e);
        }
      }
    }]
  });
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyBody');

  if (bugData.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">暂无数据</td></tr>';
    return;
  }

  const rows = bugData.slice().reverse().map(function(record) {
    const swTotal = calculateSoftwareTotal(record);
    const fwTotal = calculateFirmwareTotal(record);
    const total = swTotal + fwTotal;
    return '<tr>' +
      '<td>' + formatDate(record.date) + '</td>' +
      '<td>' + swTotal + '</td>' +
      '<td>' + fwTotal + '</td>' +
      '<td><strong>' + total + '</strong></td>' +
      '<td><button class="btn btn-danger" onclick="deleteRecord(\'' + record.date + '\')">删除</button></td>' +
      '</tr>';
  }).join('');

  tbody.innerHTML = rows;
}

function renderAll() {
  updateTotalCount();
  renderBarChart();
  renderSoftwarePieChart();
  renderFirmwarePieChart();
  renderHistoryTable();
}

function init() {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js 未加载');
    alert('图表库加载失败，请检查网络连接后刷新页面');
    return;
  }

  loadData();
  document.getElementById('dateInput').value = getTodayDate();

  FIELD_KEYS.forEach(function(key) {
    var swInput = document.getElementById('sw_' + key);
    var fwInput = document.getElementById('fw_' + key);
    swInput.addEventListener('focus', function() { this.select(); });
    fwInput.addEventListener('focus', function() { this.select(); });
  });

  document.getElementById('saveBtn').addEventListener('click', function() {
    const record = getFormData();
    if (!record) {
      alert('请选择日期');
      return;
    }
    addOrUpdateRecord(record);
    renderAll();
    alert('数据保存成功');
  });

  document.getElementById('resetBtn').addEventListener('click', function() {
    resetForm();
  });

  document.getElementById('dateInput').addEventListener('change', function() {
    const date = this.value;
    const existing = bugData.find(function(r) { return r.date === date; });
    if (existing) {
      setFormData(existing);
    } else {
      FIELD_KEYS.forEach(function(key) {
        document.getElementById('sw_' + key).value = '';
        document.getElementById('fw_' + key).value = '';
      });
    }
  });

  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
