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

  render() {
    RNCalendarReminders.authorizeEventStore()
      .then(status => {
        return RNCalendarReminders.fetchAllReminders();
      })
      .then(reminders => {
        console.log(`got reminders`);
        console.log(reminders);
      })
      .catch(error => {
        // handle error
        console.log(`error: ${error}`);
      });
    return (
      <SortableRemindersList />
    );
  }
}

// TODO remove
const REMINDERS = [
  {
    "location": "",
    "alarms": [],
    "recurrence": "",
    "startDate": "",
    "completionDate": "",
    "title": "Abc",
    "notes": "",
    "id": "A7E276D6-4DB4-4B1F-BB31-00D5C0A770DB",
    "isCompleted": false
  },
  {
    title: 'def'
  }];

// TODO extract to smaller files
class SortableRemindersList extends React.Component {
  render() {
    return (
      <View style={styles.container}>
        <SortSegmentedControl />
        <RemindersList reminders={REMINDERS}/>
      </View>
    );
  }
}

class SortSegmentedControl extends React.Component {
  constructor() {
    super();
    this.state = {
      selectedIndex: 0
    };
  }

  render() {
    return (
      <View style={styles.sortSegmentControlContainer}>
        <Text>
          Sort order
        </Text>
        <SegmentedControlIOS
          style={styles.sortSegmentControl}
          values={['Default', 'Priority']}
          selectedIndex={this.state.selectedIndex}
          onChange={(event) => {
            this.setState({selectedIndex: event.nativeEvent.selectedSegmentIndex});
          }}
        />
      </View>
    );
  }
}

class RemindersList extends React.Component {
  constructor() {
    super();
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    this.state = {
      dataSource: ds.cloneWithRows([])
    };
  }

  componentWillMount() {
    console.log('componentWillMount');
    const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});
    this.setState({
      dataSource: ds.cloneWithRows(this.props.reminders),
    });
  }

  render() {
    return (
      <ListView
        dataSource={this.state.dataSource}
        renderRow={(rowData) => <ReminderRow reminder={rowData}/>}
        style={styles.remindersList}
        renderSeparator={this._renderSeparator}
      />
    );
  }

  _renderSeparator(sectionID, rowID) {
    // {/*TODO extract style*/}
    console.log(`${sectionID}-${rowID}`);
    return (
      <View
        key={`${sectionID}-${rowID}`}
        style={{
          height: 1,
          backgroundColor: '#CCCCCC',
        }}
      />
    );
  }
}

class ReminderRow extends React.Component {
  render() {
    return (
      <Text>{this.props.reminder.title}</Text>
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
});

const App = StackNavigator({
  Home: {screen: HomeScreen},
});

Exponent.registerRootComponent(App);
