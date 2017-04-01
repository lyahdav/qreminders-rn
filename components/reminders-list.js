// @flow

import React from 'react';
import {List, ListItem} from 'react-native-elements';
import {StyleSheet, ScrollView, Text, View} from 'react-native';
import type {Reminder} from './types';
import {NO_PRIORITY, HIGH_PRIORITY, MEDIUM_PRIORITY, LOW_PRIORITY} from './types';

export class RemindersList extends React.Component {
  props: {
    reminders: Array<Reminder>
  };

  render() {
    const reminders = this.props.reminders;
    return (
      <ScrollView>
        <List>
          {
            reminders.map((reminder, index) => (
              <ListItem
                key={index}
                title={
                  <View style={styles.titleView}>
                    <PriorityView priority={reminder.priority}/>
                    <Text>{reminder.title}</Text>
                  </View>
                }
                hideChevron={true}
              />
            ))
          }
        </List>
      </ScrollView>
    );
  }
}

class PriorityView extends React.Component {
  render() {
    const priority = this.props.priority;
    const text = PriorityView.getPriorityText(priority);
    return ( <Text style={styles.priorityView}>{text}</Text> );
  };

  static getPriorityText(priority) {
    if (priority === NO_PRIORITY) {
      return '';
    }

    const prioritiesToCounts = {
      [HIGH_PRIORITY]: 3,
      [MEDIUM_PRIORITY]: 2,
      [LOW_PRIORITY]: 1
    };

    const count = prioritiesToCounts[priority];
    return `${'!'.repeat(count)} `;
  }
}

const styles = StyleSheet.create({
  titleView: {
    flexDirection: 'row',
    paddingLeft: 10,
    paddingTop: 5
  },
  priorityView: {
    color: 'red'
  }
});
