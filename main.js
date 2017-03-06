import Exponent from 'exponent';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import RNCalendarReminders from 'react-native-calendar-reminders';

class App extends React.Component {
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
      <View style={styles.container}>
        <Text>Open up main.js to start working on your app!123</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

Exponent.registerRootComponent(App);
