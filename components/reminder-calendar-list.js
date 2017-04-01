import React from 'react';
import RNCalendarReminders from 'react-native-calendar-reminders';
import {List, ListItem} from 'react-native-elements';

export class ReminderCalendarList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      calendars: []
    };
  }

  componentDidMount() {
    RNCalendarReminders.authorizeEventStore()
      .then(() => {
        return RNCalendarReminders.fetchReminderCalendars();
      })
      .then((calendars) => {
        this.setState({
          calendars: calendars
        })
      });
  }

  render() {
    let calendars = this.state.calendars;
    return (
      <List>
        {
          calendars.map((calendar, index) => (
            <ListItem
              key={index}
              title={calendar.title}
              onPress={() => {this.onPressRow(calendar)}}
            />
          ))
        }
      </List>
    );
  }

  onPressRow(calendar) {
    const {navigate} = this.props.navigation;
    navigate('RemindersList', {
      calendarIdentifier: calendar.calendarIdentifier,
      title: calendar.title
    });
  }
}
