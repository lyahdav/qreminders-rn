import React from 'react';
import {List, ListItem} from 'react-native-elements';
import {ScrollView} from 'react-native';

export class RemindersList extends React.Component {
  render() {
    const reminders = this.props.reminders;
    return (
      <ScrollView>
        <List>
          {
            reminders.map((reminder, index) => (
              <ListItem
                key={index}
                title={`${reminder.priority} ${reminder.title}`}
                hideChevron={true}
              />
            ))
          }
        </List>
      </ScrollView>
    );
  }
}
