import codec from './codec'
import {createStore} from 'redux'
import devToolsEnhancer from 'remote-redux-devtools'
import reducer from './reducer'
import bus from '@theatersoft/bus'
import {initDevices, command, off, rx} from './actions'

export class X10 {
    start ({name, config: {vid, pid, devices, remotedev: hostname = 'localhost'}}) {
        this.name = name
        return bus.registerObject(name, this)
            .then(obj => {
                this.store = createStore(
                    reducer,
                    {devices: {}},
                    devToolsEnhancer({name: 'X10', realtime: true, port: 6400, hostname})
                )
                this.store.dispatch(initDevices(devices))
                devices.forEach(dev => this.store.dispatch(off(dev.id)))
                this.store.subscribe(() =>
                    obj.signal('state', this.store.getState()))
                codec.init({vid, pid})
                codec.on('rx', action => this.store.dispatch(rx(action)))
                const register = () => bus.proxy('Device').registerService(this.name)
                bus.registerListener(`Device.start`, register)
                bus.on('reconnect', register)
                register()
            })
    }

    stop () {
        return codec.close()
            .then(() => bus.unregisterObject(this.name))
    }

    send (cmd) {
        return codec.sendCommand(cmd)
    }

    dispatch (action) {
        return this.send(command(action))
            .then(() =>
                this.store.dispatch(action))
    }

    getState () {
        return this.store.getState()
    }
}
