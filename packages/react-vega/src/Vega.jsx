/* eslint-disable react/no-unused-prop-types */
/* eslint-disable react/forbid-prop-types */
import * as vega from 'vega';

import PropTypes from 'prop-types';
import React from 'react';
import { capitalize, isDefined, isFunction } from './util';

const propTypes = {
  background: PropTypes.string,
  className: PropTypes.string,
  data: PropTypes.object,
  enableHover: PropTypes.bool,
  height: PropTypes.number,
  logLevel: PropTypes.number,
  onNewView: PropTypes.func,
  onParseError: PropTypes.func,
  padding: PropTypes.object,
  renderer: PropTypes.string,
  loader: PropTypes.object,
  spec: PropTypes.object.isRequired,
  style: PropTypes.object,
  tooltip: PropTypes.func,
  width: PropTypes.number,
};

const defaultProps = {
  background: undefined,
  className: '',
  data: {},
  enableHover: true,
  height: undefined,
  logLevel: undefined,
  onNewView() {},
  onParseError() {},
  padding: undefined,
  renderer: 'svg',
  loader: undefined,
  style: undefined,
  tooltip: () => {},
  width: undefined,
};

class Vega extends React.Component {
  static isSamePadding(a, b) {
    if (isDefined(a) && isDefined(b)) {
      return a.top === b.top && a.left === b.left && a.right === b.right && a.bottom === b.bottom;
    }

    return a === b;
  }

  static isSameData(a, b) {
    return a === b && !isFunction(a);
  }

  static isSameSpec(a, b) {
    return a === b || JSON.stringify(a) === JSON.stringify(b);
  }

  static listenerName(signalName) {
    return `onSignal${capitalize(signalName)}`;
  }

  componentDidMount() {
    const { spec } = this.props;
    this.createView(spec);
  }

  componentDidUpdate(prevProps) {
    const { spec } = this.props;
    if (spec !== prevProps.spec) {
      this.clearView();
      this.createView(spec);
    } else if (this.view) {
      const { props } = this;
      let changed = false;

      // update view properties
      ['width', 'height', 'renderer', 'logLevel', 'background']
        .filter(field => props[field] !== prevProps[field])
        .forEach(field => {
          this.view[field](props[field]);
          changed = true;
        });

      if (!Vega.isSamePadding(props.padding, prevProps.padding)) {
        this.view.padding(props.padding || spec.padding);
        changed = true;
      }

      // update data
      if (spec.data && props.data) {
        spec.data.forEach(d => {
          const oldData = prevProps.data[d.name];
          const newData = props.data[d.name];
          if (!Vega.isSameData(oldData, newData)) {
            this.updateData(d.name, newData);
            changed = true;
          }
        });
      }

      if (props.enableHover !== prevProps.enableHover) {
        changed = true;
      }

      if (changed) {
        if (props.enableHover) {
          this.view.hover();
        }
        this.view.run();
      }
    }
  }

  componentWillUnmount() {
    this.clearView();
  }

  createView(spec) {
    if (spec) {
      const { props } = this;
      // Parse the vega spec and create the view
      try {
        const runtime = vega.parse(spec);
        const viewConfig = props.loader ? { loader: props.loader } : {};
        const view = new vega.View(runtime, viewConfig).initialize(this.element);

        // Attach listeners onto the signals
        if (spec.signals) {
          spec.signals.forEach(signal => {
            view.addSignalListener(signal.name, (...args) => {
              const listener = props[Vega.listenerName(signal.name)];
              if (listener) {
                listener.apply(this, args);
              }
            });
          });
        }

        // store the vega.View object to be used on later updates
        this.view = view;

        ['logLevel', 'renderer', 'tooltip', 'background', 'width', 'height', 'padding']
          .filter(field => isDefined(props[field]))
          .forEach(field => {
            view[field](props[field]);
          });

        if (spec.data && props.data) {
          spec.data
            .filter(d => props.data[d.name])
            .forEach(d => {
              this.updateData(d.name, props.data[d.name]);
            });
        }
        if (props.enableHover) {
          view.hover();
        }
        view.run();

        props.onNewView(view);
      } catch (ex) {
        this.clearView();
        props.onParseError(ex);
      }
    } else {
      this.clearView();
    }

    return this;
  }

  updateData(name, value) {
    if (value) {
      if (isFunction(value)) {
        value(this.view.data(name));
      } else {
        this.view.change(
          name,
          vega
            .changeset()
            .remove(() => true)
            .insert(value),
        );
      }
    }
  }

  clearView() {
    if (this.view) {
      this.view.finalize();
      this.view = null;
    }

    return this;
  }

  render() {
    const { className, style } = this.props;

    return (
      // Create the container Vega draws inside
      <div
        ref={c => {
          this.element = c;
        }}
        className={className}
        style={style}
      />
    );
  }
}

Vega.propTypes = propTypes;
Vega.defaultProps = defaultProps;

export default Vega;
