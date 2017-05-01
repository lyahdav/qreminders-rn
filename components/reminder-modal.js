// @flow

import React from 'react';
import {Button, Modal, StyleSheet, Text, View} from 'react-native';
import {List, Icon} from 'react-native-elements';
import RNCalendarReminders from 'react-native-calendar-reminders';
import moment from 'moment';

import type {Reminder} from './types';

export class ReminderModal extends React.Component {
  props: {
    reminder: Reminder,
    onReminderChanged: () => void
  };

  state = {
    visible: false,
  };

  setModalVisible = (visible: boolean) => {
    this.setState({visible});
  };

  render() {
    return (
      <Modal
        animationType='fade'
        transparent={true}
        visible={this.state.visible}
        onRequestClose={() => this.setModalVisible(false)}
      >
        <View style={styles.container}>
          <View style={styles.innerContainer}>
            <View style={styles.row}>
              <ModalButton icon='check' text='Complete' onPress={this.onCompletePress}/>
            </View>
            <View style={styles.row}>
              <ModalButton icon='clock-o' text='15 minutes' onPress={() => this.onSnoozePress(15)} />
              <ModalButton icon='clock-o' text='30 minutes' onPress={() => this.onSnoozePress(30)} />
              <ModalButton icon='clock-o' text='1 hour' onPress={() => this.onSnoozePress(60)} />
            </View>
            <View style={[styles.row, styles.lastRow]}>
              <Button
                title='Close'
                onPress={() => this.setModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

    );
  }

  onCompletePress = () => {
    this.updateReminder({
      isCompleted: true
    });
  };

  updateReminder(updates: {isCompleted?: boolean}) {
    RNCalendarReminders.updateReminder(this.props.reminder.id, updates).then(() => {
      this.props.onReminderChanged();
    }).catch(error => {
      // handle error
    });

    this.setModalVisible(false);
  }

  onSnoozePress(snoozeMinutes: number) {
    const date = moment().add(snoozeMinutes, 'minutes');
    this.updateReminder({
      dueDate: date.valueOf(),
      startDate: date.valueOf(),
      alarms: [
        {
          date: date.toISOString()
        }
      ]
    });
  }
}

function ModalButton(props) {
  const ICON_SIZE = 36;
  return (
    <View>
      <Icon
        raised
        name={props.icon}
        type='font-awesome'
        size={ICON_SIZE}
        color={props.color}
        onPress={props.onPress}/>
      <Text style={{textAlign: 'center'}}>{props.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  innerContainer: {
    padding: 20,
    backgroundColor: '#fff'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  lastRow: {
    paddingTop: 20
  }
});
