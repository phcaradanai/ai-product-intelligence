export { METRIC_DEFINITIONS } from "./definitions.ts";
export type { MetricDefinition, MetricId } from "./definitions.ts";
export {
  availableStock, computeSkuMetrics, grossRevenue, realizedGrossMarginRatio, salesGrowthUnits,
  sellThroughProxy, stockCoverDays, unitsSold, MetricInputError,
} from "./compute.ts";
export type { MetricOptions, MetricReason, MetricResult, MetricStatus, MetricWindow } from "./compute.ts";
