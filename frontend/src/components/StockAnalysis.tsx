import React, { useState, useCallback } from 'react';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Box,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
// Wails bindings are available globally after runtime initialization
declare global {
  interface Window {
    go: {
      main: {
        App: {
          GetStockData: () => Promise<string>;
          CalculateFiveDayRate: (data: string) => Promise<string>;
        };
      };
    };
  }
}

const GetStockData = () => window.go.main.App.GetStockData();
const CalculateFiveDayRate = (data: string) => window.go.main.App.CalculateFiveDayRate(data);

// TypeScript interfaces
interface StockData {
  date: string;
  volume: number;
  turnover: number;
  fiveDayVolumeRate: number;
  fiveDayTurnoverRate: number;
}

const StockAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  const analyzeStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAnalysisComplete(false);
    
    try {
      console.log('开始获取股票数据...');
      // 获取股票数据
      const stockDataResult = await GetStockData();
      console.log('股票数据获取成功:', stockDataResult.substring(0, 100) + '...');
      
      // 计算五日变动率
      const analysisResult = await CalculateFiveDayRate(stockDataResult);
      console.log('五日变动率计算成功:', analysisResult.substring(0, 100) + '...');
      
      const data: StockData[] = JSON.parse(analysisResult);
      console.log('解析后的数据:', data.length, '条记录');
      
      if (!data || data.length === 0) {
        throw new Error('没有获取到股票数据');
      }
      
      // 确保数据按日期排序（最新的在最后）
      const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setStockData(sortedData);
      setAnalysisComplete(true);
      console.log('数据设置完成，已按日期排序');
      console.log('最早日期:', sortedData[0]?.date);
      console.log('最新日期:', sortedData[sortedData.length - 1]?.date);
    } catch (err: any) {
      console.error('分析过程中出错:', err);
      setError(`分析失败: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const getLatestData = () => {
    if (!stockData || stockData.length === 0) return null;
    const latest = stockData[stockData.length - 1];
    // 确保数据结构正确
    if (!latest || latest.fiveDayVolumeRate === undefined || latest.fiveDayTurnoverRate === undefined) {
      console.warn('数据结构不正确:', latest);
      return null;
    }
    return latest;
  };

  const latestData = getLatestData();

  const formatNumber = (num: number): string => {
    // 使用 Number.isFinite 来正确检查是否为有效数字
    if (!Number.isFinite(num)) {
      return 'N/A';
    }
    if (num >= 1e8) {
      return (num / 1e8).toFixed(2) + '亿';
    } else if (num >= 1e4) {
      return (num / 1e4).toFixed(2) + '万';
    }
    return num.toLocaleString();
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
          股票五日资金变动率分析
        </Typography>
        
        <Box display="flex" justifyContent="center" mb={4}>
          <Button
            variant="contained"
            size="large"
            onClick={analyzeStock}
            disabled={loading}
            sx={{
              bgcolor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              px: 4,
              py: 2,
              fontSize: '16px',
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : '分析股票数据'}
          </Button>
        </Box>

        {loading && (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CircularProgress size={24} />
                <Typography>正在获取和分析股票数据...</Typography>
              </Box>
              <LinearProgress />
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {analysisComplete && latestData && (
          <>
            {/* Summary Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
              <Card sx={{ flex: 1, minWidth: 200 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    最新交易日
                  </Typography>
                  <Typography variant="h5" component="div">
                    {latestData.date}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, minWidth: 200 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    五日成交量变动率
                  </Typography>
                  <Typography variant="h5" component="div">
                    <Chip
                      label={`${latestData.fiveDayVolumeRate.toFixed(2)}%`}
                      color={latestData.fiveDayVolumeRate > 0 ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, minWidth: 200 }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    五日成交额变动率
                  </Typography>
                  <Typography variant="h5" component="div">
                    <Chip
                      label={`${latestData.fiveDayTurnoverRate.toFixed(2)}%`}
                      color={latestData.fiveDayTurnoverRate > 0 ? 'success' : 'error'}
                      variant="outlined"
                    />
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Charts */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
              <Card sx={{ flex: 1, minWidth: 300 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    五日成交量变动率趋势
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stockData.slice(-20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="fiveDayVolumeRate"
                        stroke="#2196f3"
                        strokeWidth={2}
                        name="成交量变动率"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, minWidth: 300 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    五日成交额变动率趋势
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stockData.slice(-20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="fiveDayTurnoverRate"
                        stroke="#f44336"
                        strokeWidth={2}
                        name="成交额变动率"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>

            {/* Data Table */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  最近20个交易日数据
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>日期</TableCell>
                        <TableCell align="right">成交量</TableCell>
                        <TableCell align="right">成交额</TableCell>
                        <TableCell align="right">五日成交量变动率</TableCell>
                        <TableCell align="right">五日成交额变动率</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stockData.slice(-20).reverse().map((row, index) => (
                        <TableRow key={index}>
                          <TableCell component="th" scope="row">
                            {row.date}
                          </TableCell>
                          <TableCell align="right">
                            {formatNumber(row.volume)}
                          </TableCell>
                          <TableCell align="right">
                            {formatNumber(row.turnover)}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${row.fiveDayVolumeRate.toFixed(2)}%`}
                              color={row.fiveDayVolumeRate > 0 ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${row.fiveDayTurnoverRate.toFixed(2)}%`}
                              color={row.fiveDayTurnoverRate > 0 ? 'success' : 'error'}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Container>
  );
};

export default StockAnalysis;
