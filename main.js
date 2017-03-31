import Exponent from 'exponent';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ListView,
  SegmentedControlIOS,
  TouchableHighlight
} from 'react-native';
import {StackNavigator} from 'react-navigation';

import RNCalendarReminders from 'react-native-calendar-reminders';

class ReminderCalendarList extends React.Component {
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
    let dataSource = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    dataSource = dataSource.cloneWithRows(this.state.calendars);

    return (
      <ListView
        dataSource={dataSource}
        renderRow={(calendar) => <CalendarRow calendar={calendar} navigation={this.props.navigation}/>}
        renderSeparator={(sectionID, rowID) => {
          return renderSeparator(sectionID, rowID, this.state.calendars.length);
        }}
        enableEmptySections={true}
      />
    );
  }
}

class CalendarRow extends React.Component {
  onPressRow() {
    const {navigate} = this.props.navigation;
    navigate('RemindersList', {
      calendarIdentifier: this.props.calendar.calendarIdentifier,
      title: this.props.calendar.title
    });
  }

  render() {
    return (
      <TouchableHighlight style={styles.row} onPress={this.onPressRow.bind(this)}>
        <View style={styles.rowContainer}>
          <Text style={styles.calendarRowTitle}>{this.props.calendar.title}</Text>
        </View>
      </TouchableHighlight>
    );
  }
}

class HomeScreen extends React.Component {
  static navigationOptions = {
    title: 'Lists',
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
  static navigationOptions = {
    title: ({ state }) => state.title
  };

  render() {
    const { params } = this.props.navigation.state;
    return (
      <SortableRemindersList calendarIdentifier={params.calendarIdentifier} />
    );
  }
}

const SORT_TYPE_DEFAULT = 0;
const SORT_TYPE_PRIORITY = 1;

// TODO extract to smaller files
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
        <RemindersList reminders={reminders} sortTypeIndex={this.state.sortTypeIndex}/>
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
    // 0 priority means none. 1 = highest, 9 = lowest
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
    this.props.onChange(event.nativeEvent.selectedSegmentIndex);
  }
}

function renderSeparator(sectionID, rowID, listLength) {
  let isLastRow = rowID === listLength - 1;
  if (isLastRow) {
    return null;
  }
  return (
    <View
      key={`${sectionID}-${rowID}`}
      style={styles.separator}
    />
  );
}

class RemindersList extends React.Component {
  render() {
    let dataSource = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    dataSource = dataSource.cloneWithRows(this.props.reminders);

    return (
      <ListView
        dataSource={dataSource}
        renderRow={(rowData) => <ReminderRow reminder={rowData}/>}
        style={styles.remindersList}
        renderSeparator={(sectionID, rowID) => {
          return renderSeparator(sectionID, rowID, this.props.reminders.length);
        }}
        enableEmptySections={true}
      />
    );
  }
}

class ReminderRow extends React.Component {
  render() {
    const reminder = this.props.reminder;
    const text = `${reminder.priority} ${reminder.title}`;
    return (
      <View style={styles.row}>
        <Text>{text}</Text>
      </View>
    );
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
  },
  rowContainer: {
    padding: 10,
    backgroundColor: '#fff'
  },
  row: {
    justifyContent: 'center',
  },
  calendarRowTitle: {
    backgroundColor: '#fff'
  }
});

const App = StackNavigator({
  Home: {screen: HomeScreen},
  RemindersList: {screen: ReminderListScreen}
});

Exponent.registerRootComponent(App);
