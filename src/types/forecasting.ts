export type ForecastStatus = "success" | "insufficient_data" | "failed";

export interface MonthlyForecast {
  id: number;
  period: string;
  predicted_amount: string;
  lower_bound: string;
  upper_bound: string;
}

export interface ForecastRun {
  id: number;
  project: number;
  run_by: number;
  run_at: string;
  months_of_history: number;
  arima_order: string;
  status: ForecastStatus;
  error_message: string;
  mae: string | null;
  rmse: string | null;
  mape: string | null;
  approved_budget_total: string | null;
  actual_to_date: string | null;
  projected_total_at_horizon: string | null;
  is_overrun_risk: boolean;
  forecasts: MonthlyForecast[];
}
