// @flow

import React from 'react';
import {List} from 'react-native-elements';
import {ScrollView} from 'react-native';

import type {Reminder} from './types';
import {ReminderItem} from './reminder-item';

export class RemindersList extends React.Component {
  props: {
    reminders: Array<Reminder>,
    onReminderChanged: () => void
  };

  render() {
    const reminders = this.props.reminders;
    return (
      <ScrollView>
        <List>
          {
            reminders.map((reminder, index) => (
              <ReminderItem
                key={index}
                reminder={reminder}
                onReminderChanged={this.props.onReminderChanged}
              />
            ))
          }
        </List>
      </ScrollView>
    );
  }
}
