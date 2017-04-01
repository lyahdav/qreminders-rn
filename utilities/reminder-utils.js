// @flow

import type {Alarm, Reminder} from '../components/types';

export class ReminderUtils {
  static getFirstAlarm(reminder: Reminder): ?Alarm {
    return reminder.alarms.length > 0 ? reminder.alarms[0] : null;
  }
}
