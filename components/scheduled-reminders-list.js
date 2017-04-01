import React from 'react';
import RNCalendarReminders from 'react-native-calendar-reminders';

import {RemindersList} from './reminders-list';

export class ScheduledRemindersList extends React.Component {
  constructor(props) {
    super(props);
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

  render() {
    const reminders = this.getReminders();
    return (
      <RemindersList reminders={reminders}/>
    );
  }

  getReminders() {
    const reminders = this.state.reminders;
    console.log(reminders);
    return reminders;
  }
}
