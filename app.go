package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetStockData returns stock data
func (a *App) GetStockData() (string, error) {
	// Get current date in China Standard Time (Shanghai)
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.Local // fallback to local time
	}
	now := time.Now().In(loc)

	// Calculate 180 days ago
	startDate := now.AddDate(0, 0, -180)

	// Format dates
	startDateStr := startDate.Format("20060102")
	endDateStr := now.Format("20060102")

	// Build URL
	url := fmt.Sprintf("https://q.stock.sohu.com/hisHq?code=zs_000001&start=%s&end=%s&stat=1&order=D&period=d",
		startDateStr, endDateStr)

	// Debug: Print the dates being used
	fmt.Printf("Requesting data from %s to %s\n", startDateStr, endDateStr)
	fmt.Printf("Current time: %v, Start date: %v\n", now, startDate)

	// Make HTTP request
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// StockData represents stock data structure
type StockData struct {
	Date                string  `json:"date"`
	Volume              float64 `json:"volume"`
	Turnover            float64 `json:"turnover"`
	FiveDayVolumeRate   float64 `json:"fiveDayVolumeRate"`
	FiveDayTurnoverRate float64 `json:"fiveDayTurnoverRate"`
}

// CalculateFiveDayRate calculates 5-day rate change
func (a *App) CalculateFiveDayRate(data string) (string, error) {
	// Parse JSON data
	var stockData []map[string]interface{}
	err := json.Unmarshal([]byte(data), &stockData)
	if err != nil {
		return "", fmt.Errorf("failed to parse JSON: %v", err)
	}

	if len(stockData) == 0 {
		return "", fmt.Errorf("no stock data available")
	}

	// Get hq data - handle different types
	var hqData []interface{}
	switch v := stockData[0]["hq"].(type) {
	case []interface{}:
		hqData = v
	default:
		return "", fmt.Errorf("unexpected hq data type: %T", v)
	}

	if len(hqData) == 0 {
		return "", fmt.Errorf("no hq data available")
	}

	// Create a slice to hold the extracted data with proper structure
	type DailyData struct {
		Date     string
		Volume   float64
		Turnover float64
		Index    int // original index in hqData
	}

	var dailyData []DailyData

	// Extract data from hqData
	for i, item := range hqData {
		switch row := item.(type) {
		case []interface{}:
			if len(row) >= 9 {
				date := ""
				volume := 0.0
				turnover := 0.0

				// Extract data safely
				if str, ok := row[0].(string); ok {
					date = str
				}
				if str, ok := row[7].(string); ok && str != "-" {
					if val, err := strconv.ParseFloat(str, 64); err == nil {
						volume = val
					}
				}
				if str, ok := row[8].(string); ok && str != "-" {
					if val, err := strconv.ParseFloat(str, 64); err == nil {
						turnover = val
					}
				}

				dailyData = append(dailyData, DailyData{
					Date:     date,
					Volume:   volume,
					Turnover: turnover,
					Index:    i,
				})
			}
		}
	}

	// Sort by date to ensure chronological order (oldest first)
	// The API returns data in reverse chronological order, so we need to reverse it
	for i := len(dailyData)/2 - 1; i >= 0; i-- {
		opp := len(dailyData) - 1 - i
		dailyData[i], dailyData[opp] = dailyData[opp], dailyData[i]
	}

	// Calculate 5-day rate change
	var results []StockData
	for i, current := range dailyData {
		volumeRate := 0.0
		turnoverRate := 0.0

		if i >= 5 {
			prev := dailyData[i-5]

			// Debug: Print calculation details
			fmt.Printf("计算第%d天的变动率: 当前日期=%s, 5天前日期=%s\n", i, current.Date, prev.Date)
			fmt.Printf("计算第%d天的变动率: 当前成交量=%f, 5天前成交量=%f\n", i, current.Volume, prev.Volume)
			fmt.Printf("计算第%d天的变动率: 当前成交额=%f, 5天前成交额=%f\n", i, current.Turnover, prev.Turnover)

			if prev.Volume != 0 {
				volumeRate = (current.Volume - prev.Volume) / prev.Volume * 100
				fmt.Printf("成交量变动率: (%f - %f) / %f * 100 = %f%%\n", current.Volume, prev.Volume, prev.Volume, volumeRate)
			}
			if prev.Turnover != 0 {
				turnoverRate = (current.Turnover - prev.Turnover) / prev.Turnover * 100
				fmt.Printf("成交额变动率: (%f - %f) / %f * 100 = %f%%\n", current.Turnover, prev.Turnover, prev.Turnover, turnoverRate)
			}
		} else {
			// Debug: Print for first 5 days
			fmt.Printf("第%d天: 数据不足5天，变动率为0\n", i)
		}

		stockItem := StockData{
			Date:                current.Date,
			Volume:              current.Volume,
			Turnover:            current.Turnover,
			FiveDayVolumeRate:   volumeRate,
			FiveDayTurnoverRate: turnoverRate,
		}
		results = append(results, stockItem)
	}

	// Convert result to JSON
	jsonResult, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to marshal result: %v", err)
	}

	return string(jsonResult), nil
}

// GetStockAnalysis returns complete stock analysis
func (a *App) GetStockAnalysis() (string, error) {
	// Get stock data
	stockData, err := a.GetStockData()
	if err != nil {
		return "", fmt.Errorf("failed to get stock data: %v", err)
	}

	// Calculate 5-day rates
	analysisData, err := a.CalculateFiveDayRate(stockData)
	if err != nil {
		return "", fmt.Errorf("failed to calculate rates: %v", err)
	}

	return analysisData, nil
}
