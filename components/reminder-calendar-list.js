import React from 'react';
import RNCalendarReminders from 'react-native-calendar-reminders';
import {List, ListItem} from 'react-native-elements';
import {ScrollView} from 'react-native';

export const SCHEDULED_CALENDAR_IDENTIFIER = 'SCHEDULED_CALENDAR_IDENTIFIER';

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
    const calendars = this.state.calendars;
    const scheduleCalendar = {
      title: 'Scheduled',
      color: 'gray',
      calendarIdentifier: SCHEDULED_CALENDAR_IDENTIFIER
    };
    const list = [scheduleCalendar].concat(calendars);

    return (
      <ScrollView>
        <List>
          {
            list.map((calendar, index) => (
              <ListItem
                key={index}
                title={calendar.title}
                titleStyle={{color: calendar.color}}
                onPress={() => {
                  this.onPressRow(calendar)
                }}
              />
            ))
          }
        </List>
      </ScrollView>
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
