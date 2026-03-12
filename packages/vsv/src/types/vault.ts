export interface VaultSettings {
  autolockMinutes: number;
}

export interface Service {
  label: string;
  comment: string;
}

export interface EnvironmentMeta {
  comment: string;
}

export interface SecretEntry {
  secret: boolean;
  values: Record<string, string>;
}

export interface Templates {
  main: Record<string, string>;
}

export interface VaultData {
  version: number;
  settings: VaultSettings;
  services: Record<string, Service>;
  environments: Record<string, EnvironmentMeta>;
  secrets: Record<string, Record<string, SecretEntry>>;
  templates: Templates;
}

export interface SearchResult {
  type: 'service' | 'env' | 'secret' | 'template';
  id: string;
  label: string;
  comment: string;
  section: string;
}

export interface EnvEntry {
  key: string;
  value: string;
  source: string | null;
  secret: boolean;
}

export interface GenerateResult {
  output: string;
  warnings: string[];
  entries: EnvEntry[];
}

