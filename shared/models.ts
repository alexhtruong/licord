export type RecordingSourceId = string

export type RecordingProject = {
  version: 1
  id: string
  createdAt: string
  assets: {
    screenVideoPath: string
    micAudioPath?: string
    systemAudioPath?: string
    telemetryPath?: string
  }
}

