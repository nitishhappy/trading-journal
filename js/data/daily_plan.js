// ============================================================================
// Trading Journal - Master Daily Plan Initializer & Fallback
// Note: Each asset is strictly decoupled and maintained in its own dedicated file:
// - Nifty: nifty_daily_plan.js (window.dailyPlanData / window.dailyPlanSummary)
// - Gold:  gold_daily_plan.js  (window.goldDailyPlanData / window.goldDailyPlanSummary)
// - BTC:   btc_daily_plan.js   (window.btcDailyPlanData / window.btcDailyPlanSummary)
// - SP500: sp500_daily_plan.js (window.sp500DailyPlanData / window.sp500DailyPlanSummary)
// ============================================================================

window.dailyPlanData = window.dailyPlanData || [];
window.dailyPlanSummary = window.dailyPlanSummary || [];
window.goldDailyPlanData = window.goldDailyPlanData || [];
window.goldDailyPlanSummary = window.goldDailyPlanSummary || [];
window.btcDailyPlanData = window.btcDailyPlanData || [];
window.btcDailyPlanSummary = window.btcDailyPlanSummary || [];
window.sp500DailyPlanData = window.sp500DailyPlanData || [];
window.sp500DailyPlanSummary = window.sp500DailyPlanSummary || [];
