// @flow

import React from 'react';
import {ListItem} from 'react-native-elements';
import {StyleSheet, Text, View} from 'react-native';
import moment from 'moment';

import type {Alarm, Reminder} from './types';
import {PriorityView} from './priority-view';
import {ReminderUtils} from '../utilities/reminder-utils';

export class ReminderItem extends React.Component {
  props: {
    reminder: Reminder
  };

  render() {
    const reminder = this.props.reminder;
    return (
      <ListItem
        title={
          <View style={styles.titleView}>
            <PriorityView priority={reminder.priority}/>
            <Text>{reminder.title}</Text>
          </View>
        }
        subtitle={ReminderItem.getSubtitle(reminder)}
        subtitleStyle={ReminderItem.getSubtitleStyle(reminder)}
        hideChevron={true}
      />
    );
  }

  static getSubtitle(reminder: Reminder) {
    const firstAlarm = ReminderUtils.getFirstAlarm(reminder);
    //noinspection EqualityComparisonWithCoercionJS
    return firstAlarm == null ? null : moment(firstAlarm.date).format('LT');
  }

  static getSubtitleStyle(reminder: Reminder) {
    const isFirstAlarmOverdue = ReminderItem.isFirstAlarmOverdue(reminder);
    const color = isFirstAlarmOverdue ? 'red' : null;
    return {color: color};
  }

  static isFirstAlarmOverdue(reminder: Reminder) {
    const firstAlarm = ReminderUtils.getFirstAlarm(reminder);
    //noinspection EqualityComparisonWithCoercionJS
    return firstAlarm != null && ReminderItem.isAlarmOverdue(firstAlarm);
  }

  static isAlarmOverdue(alarm: Alarm) {
    const alarmDate = moment(alarm.date);
    const now = moment();
    return now.diff(alarmDate) > 0;
  }
}

const styles = StyleSheet.create({
  titleView: {
    flexDirection: 'row',
    paddingLeft: 10,
    paddingTop: 5
  }
});
