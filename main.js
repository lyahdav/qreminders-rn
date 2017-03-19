import Exponent from 'exponent';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ListView,
  SegmentedControlIOS
} from 'react-native';
import {StackNavigator} from 'react-navigation';

import RNCalendarReminders from 'react-native-calendar-reminders';

class HomeScreen extends React.Component {
  static navigationOptions = {
    title: 'Reminders',
  };

  constructor(props) {
    super(props);
    this.state = {
      reminders: []
    };
  }

  componentDidMount() {
    RNCalendarReminders.authorizeEventStore()
      .then(() => {
        return RNCalendarReminders.fetchIncompleteReminders(null, null);
      })
      .then(reminders => {
        this.setState({
          reminders: reminders
        });
      });
  }

  render() {
    return (
      <SortableRemindersList reminders={this.state.reminders}/>
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
      sortTypeIndex: SORT_TYPE_DEFAULT
    };
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
    const reminders = this.props.reminders;
    if (this.state.sortTypeIndex == SORT_TYPE_PRIORITY) {
      return reminders.concat().sort(this._sortPriority);
    } else {
      return reminders;
    }
  }

  _getPriorityForSort(reminder) {
    // 0 priority means none. 1 = highest, 9 = lowest
    return reminder.priority === 0 ? 100 : reminder.priority;
  }

  _sortPriority = (reminder1, reminder2) => {
    return this._getPriorityForSort(reminder1) - this._getPriorityForSort(reminder2);
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

class RemindersList extends React.Component {
  render() {
    let dataSource = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    dataSource = dataSource.cloneWithRows(this.props.reminders);

    return (
      <ListView
        dataSource={dataSource}
        renderRow={(rowData) => <ReminderRow reminder={rowData}/>}
        style={styles.remindersList}
        renderSeparator={this._renderSeparator.bind(this)}
        enableEmptySections={true}
      />
    );
  }

  _renderSeparator(sectionID, rowID) {
    let isLastRow = rowID == this.props.reminders.length - 1;
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
    padding: 10
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
  row: {
    height: 40,
    justifyContent: 'center'
  }
});

const App = StackNavigator({
  Home: {screen: HomeScreen},
});

Exponent.registerRootComponent(App);
