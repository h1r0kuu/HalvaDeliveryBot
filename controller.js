const {Address} = require("./models/model")
module.exports = {
    async getCustomerAddresses(user_id) {
        const allAddresses = []
        const addresses = await Address.findAll({where: {customerUserId: user_id}})
        addresses.forEach( address => {
            allAddresses.push(address.address_name)
        })
        return allAddresses
    },
}