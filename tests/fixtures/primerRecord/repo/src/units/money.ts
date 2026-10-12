import { renderReport } from "../report/renderReport.js";

export const money = (cents: number[]): string => renderReport(cents);
