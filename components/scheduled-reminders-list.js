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
    this.state.reminders.forEach((reminder) => {
      const reminderDateString = ScheduledRemindersList.getReminderDateString(reminder);
      if (!remindersGroupedByDate[reminderDateString]) {
        remindersGroupedByDate[reminderDateString] = [];
      }
      remindersGroupedByDate[reminderDateString].push(reminder);
    });
    return remindersGroupedByDate;
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
    const firstAlarm = ReminderUtils.getFirstAlarm(reminder);
    if (firstAlarm == null) {
      throw 'no alarm on reminder';
    }
    return moment(firstAlarm.date).format('l');
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
