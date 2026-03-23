export const IPC = {
  ping: 'licord:ping',
  // recordingStart: 'licord:recording:start',
  // recordingStop: 'licord:recording:stop',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

