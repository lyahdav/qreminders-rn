//noinspection JSUnresolvedVariable
import Exponent from 'exponent';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SegmentedControlIOS
} from 'react-native';
import {StackNavigator} from 'react-navigation';
//noinspection NpmUsedModulesInstalled
import RNCalendarReminders from 'react-native-calendar-reminders';

import {ReminderCalendarList, SCHEDULED_CALENDAR_IDENTIFIER} from './components/reminder-calendar-list';
import {RemindersList} from './components/reminders-list';
import {ScheduledRemindersList} from './components/scheduled-reminders-list';

class HomeScreen extends React.Component {
  //noinspection JSUnusedGlobalSymbols
  static navigationOptions = {
    title: 'Lists'
  };

  render() {
    return (
      <View style={styles.container}>
        <ReminderCalendarList navigation={this.props.navigation}/>
      </View>
    );
  }
}

class ReminderListScreen extends React.Component {
  //noinspection JSUnusedGlobalSymbols
  static navigationOptions = {
    title: ({state}) => state.params.title
  };

  render() {
    const {params} = this.props.navigation.state;
    if (params.calendarIdentifier === SCHEDULED_CALENDAR_IDENTIFIER) {
      return <ScheduledRemindersList />;
    }
    return (
      <SortableRemindersList calendarIdentifier={params.calendarIdentifier}/>
    );
  }
}

const SORT_TYPE_DEFAULT = 0;
const SORT_TYPE_PRIORITY = 1;

class SortableRemindersList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortTypeIndex: SORT_TYPE_DEFAULT,
      reminders: []
    };
  }

  componentDidMount() {
    const calendarIdentifiers = [this.props.calendarIdentifier];
    //noinspection JSUnresolvedFunction
    RNCalendarReminders.fetchIncompleteReminders(null, null, calendarIdentifiers)
      .then((reminders) => {
        this.setState({
          reminders: reminders
        })
      });
  }

  render() {
    const reminders = this.getReminders();
    return (
      <View style={styles.container}>
        <SortSegmentedControl
          onChange={this.onSortSegmentChange.bind(this)}
          selectedIndex={this.state.sortTypeIndex}/>
        <RemindersList reminders={reminders}/>
      </View>
    );
  }

  onSortSegmentChange(selectedIndex) {
    this.setState({
      sortTypeIndex: selectedIndex
    });
  }

  getReminders() {
    const reminders = this.state.reminders;
    if (this.state.sortTypeIndex === SORT_TYPE_PRIORITY) {
      return reminders.concat().sort(this._sortPriority);
    } else {
      return reminders;
    }
  }

  static _getPriorityForSort(reminder) {
    return reminder.priority === 0 ? 100 : reminder.priority;
  }

  _sortPriority = (reminder1, reminder2) => {
    return SortableRemindersList._getPriorityForSort(reminder1) - SortableRemindersList._getPriorityForSort(reminder2);
  };
}

class SortSegmentedControl extends React.Component {
  render() {
    return (
      <View style={styles.sortSegmentControlContainer}>
        <Text>
          Sort order
        </Text>
        <SegmentedControlIOS
          style={styles.sortSegmentControl}
          values={['Default', 'Priority']}
          selectedIndex={this.props.selectedIndex}
          onChange={this.onSegmentChange.bind(this)}
        />
      </View>
    );
  }

  onSegmentChange(event) {
    //noinspection JSUnresolvedVariable
    this.props.onChange(event.nativeEvent.selectedSegmentIndex);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sortSegmentControlContainer: {
    alignItems: 'center'
  },
  sortSegmentControl: {
    marginTop: 10,
    width: 120,
  },
  remindersList: {
    marginTop: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
  }
});

const App = StackNavigator({
  Home: {screen: HomeScreen},
  RemindersList: {screen: ReminderListScreen}
});

Exponent.registerRootComponent(App);
