// @flow

export const NO_PRIORITY = 0;
export const HIGH_PRIORITY = 1;
export const MEDIUM_PRIORITY = 5;
export const LOW_PRIORITY = 9;

export type Alarm = {
  date: string
};

export type Reminder = {
  id: string,
  priority: number,
  title: string,
  alarms: Alarm[]
};
