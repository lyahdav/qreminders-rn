import React from 'react';
import {StyleSheet} from 'react-native';
import {Text} from 'react-native';
import {HIGH_PRIORITY, LOW_PRIORITY, MEDIUM_PRIORITY, NO_PRIORITY} from './types';

export class PriorityView extends React.Component {
  render() {
    const priority = this.props.priority;
    const text = PriorityView.getPriorityText(priority);
    return ( <Text style={styles.priorityView}>{text}</Text> );
  };

  static getPriorityText(priority) {
    if (priority === NO_PRIORITY) {
      return '';
    }

    const prioritiesToCounts = {
      [HIGH_PRIORITY]: 3,
      [MEDIUM_PRIORITY]: 2,
      [LOW_PRIORITY]: 1
    };

    const count = prioritiesToCounts[priority];
    return `${'!'.repeat(count)} `;
  }
}

const styles = StyleSheet.create({
  priorityView: {
    color: 'red'
  }
});
