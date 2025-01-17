import { ReadFactory } from './ReadFactory';
export class ReadWriteFactory extends ReadFactory {
    constructor(address, drift) {
        super(address, drift);
    }
    async create(params, options) {
        return this.airlock.write('create', params, options);
    }
}
//# sourceMappingURL=ReadWriteFactory.js.map