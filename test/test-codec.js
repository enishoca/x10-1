'use strict'
const
    CMD = {
        STATUS: 0x8b,
        SETCLOCK: 0x9b,
        CMDAB: 0xab,
        WRITE: 0xbb,
        CMDCB: 0xcb,
        READ: 0xdb,
        SENDRF: 0xeb,
        MACRO: 0xfb
    },
    FUNC = {AOFF: 0, ALON: 1, ON: 2, OFF: 3, DIM: 4, BRIGHT: 5, ALOFF: 6, EXT: 7, HAILREQ: 8, HAILACK: 9, PDIM1: 0xa, PDIM2: 0xb},
    addrToString = (house, unit) => String.fromCharCode(house + 65) + String.fromCharCode(unit + 49),
    funcToString = func => getKeyByValue(FUNC, func) || '???',
    getKeyByValue = (obj, value) => {for (let key of Object.keys(obj)) if (obj[key] === value) return key},
    stringToAddr = s => ([s.charCodeAt(0) - 65, s.charCodeAt(1) - 49]),
    stringToFunc = s => FUNC[s],
    fromHexString = s => Buffer.from(s.split(' ').map(n => Number.parseInt(n, 16)))

const
    ADDR = [6, 14, 2, 10, 1, 9, 5, 13, 7, 15, 3, 11, 0, 8, 4, 12],
    INV_ADDR = [12, 4, 2, 10, 14, 6, 0, 8, 13, 5, 3, 11, 15, 7, 1, 9],
    encAddr = (house, unit) => ADDR[house] << 4 | ADDR[unit],
    encFunc = (house, func) => ADDR[house] << 4 | func,
    encodePL = (house, func) => new Buffer([0x06, encFunc(house, func)]),
    encodePLUnit = (house, unit, func) => new Buffer([0x04, encAddr(house, unit), 0x06, encFunc(house, func)]),
    encodeCmd = cmd => new Buffer([cmd]),
    encodeSetClock = () => {
        var now = new Date(), yday = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
        return new Buffer([
            CMD.SETCLOCK,
            now.getSeconds(), now.getMinutes() + 60 * (now.getHours() & 1), now.getHours() >> 1,
            yday, (yday & 0x100) >> 1 | 1 << now.getDay(),
            0x60, // house 0:timer purge, 1:monitor clear, 3:battery clear
            0
        ])
    },
    decHouse = addr => ADDR.indexOf(addr >> 4),
    decUnit = addr => ADDR.indexOf(addr & 0xf),
    decFunc = func => func & 0xf,
    decodePL = data => {
        if (data[1] === 0x02 && data.length == 4) {
            if (data[2] === 0x00) {  // Address
                decodePL.addr = data[3] // save address until next call
            } else if (decodePL.addr !== undefined && data[2] === 0x01) { // Function
                let r = {type: 'PL', addr: addrToString(decHouse(decodePL.addr), decUnit(decodePL.addr)), func: funcToString(decFunc(data[3]))}
                decodePL.addr = undefined
                return r
            }
        }
    }

const
    ADDR_RF = [6, 7, 4, 5, 8, 9, 10, 11, 14, 15, 12, 13, 0, 1, 2, 3],
    INV_ADDR_RF = [12, 13, 14, 15, 2, 3, 0, 1, 4, 5, 6, 7, 10, 11, 8, 9 ],
    encodeRFUnit = (house, unit, func) => {
        var buf = [CMD.SENDRF, 0x20, ADDR[house] << 4 | (unit & 8) >> 1, 0, 0, 0]
        switch (func) {
        case FUNC.OFF:
            buf[4] = 0x20
        case FUNC.ON:
            buf[4] |= (unit & 4) << 4 | (unit & 2) << 2 | (unit & 1) << 4
            break;
        default:
            throw ('Invalid func')
        }
        buf[3] = ~buf[2]
        buf[5] = ~buf[4]
        return new Buffer(buf)
    },
    decHouseRF = a => INV_ADDR_RF[a >> 4],
    decUnitRF = (a, b) => (a & 1<<2) << 1 | (b & 1<<6) >> 4 | (b & 1<<3) >> 2 | (b & 1<<4) >> 4,
    decodeRF = ([x, y, a, _a, b, _b]) => {
        if ((a ^ _a) !== 0xff || (b ^ _b) !== 0xff) {
            console.log('RX RF bad checksum', data)
            return
        }
        let house = 0, unit = 0, func
        if (b & 1<<7) { // BRIGHT or DIM
            func = b & 1<<4 ? FUNC.DIM : FUNC.BRIGHT
        }
        else {
            house = decHouseRF(a)
            unit = decUnitRF(a, b)
            func = b & 1<<5 ? FUNC.OFF : FUNC.ON
        }
        return {
            type: 'RF',
            addr: addrToString(house, unit),
            func: funcToString(func)
        }
    }

const
    log = s => {console.log(s); return s},
    rf = s => {log(decodeRF(log(fromHexString(s)))); console.log()},
    pl = s => {log(decodePL(log(fromHexString(s)))); console.log()}

rf('5d 20 60 9f 20 df') // A1 OFF
rf('5d 20 70 8f 20 df') // B1 OFF
rf('5d 20 60 9f 30 cf') // A2 OFF
rf('5d 20 60 9f 00 ff') // A1 ON

rf('5d 20 60 9f 98 67') // DIM
rf('5d 20 60 9f 88 77') // BRIGHT

//pl('5a 02 00 62')
//pl('5a 02 01 63') // A3 OFF
//pl('5a 02 00 62')
//pl('5a 02 01 63') // A3 OFF
