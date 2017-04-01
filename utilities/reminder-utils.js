// @flow

import type {Alarm, Reminder} from '../components/types';
import moment from 'moment';

export class ReminderUtils {
  static getFirstAlarm(reminder: Reminder): ?Alarm {
    return reminder.alarms.length > 0 ? reminder.alarms[0] : null;
  }

  static getFirstAlarmDateBang(reminder: Reminder): moment$Moment {
    const alarm = this.getFirstAlarm(reminder);
    if (alarm == null) {
      throw 'no alarms on reminder';
    }
    return moment(alarm.date);
  }
}
