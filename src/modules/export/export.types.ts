export interface ExportField {
  key: string;
  label: string;
}

export interface ExportRequest {
  tableName: string;
  fields: ExportField[];
}

export type ExportRow = Record<string, unknown>;