export interface BackupInfoDto {
  filename: string;
  sizeBytes: number;
  createdAtUtc: string;
  integrityStatus: string;
}

export interface BackupListResponseDto {
  backups: BackupInfoDto[];
  databaseSizeMb: number;
  lastBackupDateUtc?: string;
  isWalMode: boolean;
}

export interface CreateBackupResponseDto {
  success: boolean;
  filename: string;
  sizeBytes: number;
  createdAtUtc: string;
  message?: string;
}

export interface RestoreBackupRequestDto {
  filename: string;
  confirmCode: string;
}
