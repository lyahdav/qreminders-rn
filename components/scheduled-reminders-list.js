// @flow

import React from 'react';
import {ListView, ScrollView, StyleSheet, Text} from 'react-native';
//noinspection NpmUsedModulesInstalled $FlowFixMe
import RNCalendarReminders from 'react-native-calendar-reminders';
import {List} from 'react-native-elements';
import moment from 'moment';

import type {Reminder} from './types';
import {ReminderItem} from './reminder-item';
import {ReminderUtils} from '../utilities/reminder-utils';

export class ScheduledRemindersList extends React.Component {
  state: {
    reminders: Reminder[]
  };

  constructor() {
    super();

    this.state = {
      reminders: []
    };
  }

  componentDidMount() {
    let oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    let oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    RNCalendarReminders.fetchIncompleteReminders(oneYearAgo.getTime(), oneYearFromNow.getTime(), null)
      .then((reminders) => {
        this.setState({
          reminders: reminders
        })
      });
  }

  groupRemindersByDate() {
    let remindersGroupedByDate = {};
    let reminders = [...this.state.reminders];
    reminders.sort((reminderA, reminderB) => ScheduledRemindersList.reminderDate(reminderA) - ScheduledRemindersList.reminderDate(reminderB));

    reminders.forEach((reminder) => {
      const reminderDateString = ScheduledRemindersList.getReminderDateString(reminder);
      if (!remindersGroupedByDate[reminderDateString]) {
        remindersGroupedByDate[reminderDateString] = [];
      }
      remindersGroupedByDate[reminderDateString].push(reminder);
    });
    return remindersGroupedByDate;
  }

  static reminderDate(reminder: Reminder) {
    return ReminderUtils.getFirstAlarmDateBang(reminder).valueOf();
  }

  render() {
    //noinspection JSUnusedGlobalSymbols
    let dataSource = new ListView.DataSource({
      rowHasChanged: (r1, r2) => r1 !== r2,
      sectionHeaderHasChanged: (s1, s2) => s1 !== s2
    });

    dataSource = dataSource.cloneWithRowsAndSections(this.groupRemindersByDate());

    return (
      <ScrollView>
        <List>
          <ListView
            dataSource={dataSource}
            renderRow={ScheduledRemindersList.renderRow}
            renderSectionHeader={ScheduledRemindersList.renderSectionHeader}
          />
        </List>
      </ScrollView>
    );
  }

  //noinspection JSUnusedLocalSymbols
  static renderSectionHeader(_: any, sectionHeaderText: string) {
    return (
      <Text style={styles.sectionHeader}>{sectionHeaderText}</Text>
    );
  }

  static renderRow(reminder: Reminder, sectionID: any) {
    return (
      <ReminderItem
        key={sectionID}
        reminder={reminder}
      />
    );
  }

  static getReminderDateString(reminder: Reminder) {
    const firstAlarmDate = ReminderUtils.getFirstAlarmDateBang(reminder);
    if (this.isDateToday(firstAlarmDate)) {
      return firstAlarmDate.format('[Today], ddd l');
    } else if (this.isDateTomorrow(firstAlarmDate)) {
      return firstAlarmDate.format('[Tomorrow], ddd l');
    }
    return firstAlarmDate.format('ddd l');
  }

  static isDateToday(date) {
    return date.isSame(new Date(), "day");
  }

  static isDateTomorrow(date) {
    const tomorrow = moment().add(1, 'days').startOf('day');
    return date.isSame(tomorrow, 'day');
  }
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontWeight: 'bold',
    fontSize: 12,
    backgroundColor: 'silver',
    padding: 4
  }
});
