require("dotenv").config()
const {Telegraf,Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer, Address} = require("../models/model")
const utils = require("../utils")

const orderScene = new WizardScene("order", 
    async (ctx) => {
        try {
            await ctx.reply("📱 Для продолжения!\nотправьте свой контакт. Либо\nвведите свой номер чтобы связаться с вами\nФормат +998*********", await replyKeyboard.sendContacts(ctx.message.from.id))
            return ctx.wizard.next()  
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async (ctx) => {
        try {
            if(ctx.message.contact) {
                ctx.scene.state.phoneNumber = ctx.message.contact.phone_number
            } else {
                if(ctx.message.text != "⬅️ назад") {
                    ctx.scene.state.phoneNumber = ctx.message.text
                }
            }
            await ctx.reply("Отправьте пожалуйста локацию", await replyKeyboard.sendLocation(ctx.message.from.id))
            return ctx.wizard.next()  
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async(ctx) => {
        try {
            let address = ''
            let lat = ''
            let long = ''
            if(ctx.message.location) {
                lat = ctx.message.location.latitude
                long = ctx.message.location.longitude
                ctx.scene.state.latitude = lat
                ctx.scene.state.longitude = long
                address = await(await utils.getUserAddress(lat, long))[0]
            } else {
                address = ctx.message.text
            }
            ctx.scene.state.address = address
            const isExist = await Address.findOne({where: {customerUserId: ctx.message.from.id, address_name: address}})
            if(isExist === null) {

                await Address.create({
                    customerUserId: ctx.message.from.id,
                    address_name: address,
                    address: (!isNaN(lat) && !isNaN(lat)) ? `${lat},${long}` : null

                })
            }
            await ctx.wizard.selectStep(3);
            context = await replyKeyboard.back()
            context.parse_mode = "HTML"
            await ctx.reply("Здесь вы можете оставить коментарий к заказу. Например:  <b>дом №18, Второй подъезд слева, третий этаж, 15-я квартира.</b>\nЛибо напишите 'ok'", context)
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },
    async (ctx) => {
        try {
            const msg = ctx.message.text
            if(msg != "ok"){
                ctx.scene.state.addInfo = msg
            }
            await ctx.reply("Выберите способ оплаты", await replyKeyboard.paymentMethod())
            return ctx.wizard.next()
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    
    },
    async (ctx) => {
        try {
            const paymentType = ctx.message.text
            ctx.scene.state.paymentType = paymentType
            await ctx.reply("Добавить салфетки и столовые приборы?", replyKeyboard.yesNo())
            return ctx.wizard.next()
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    },

    async (ctx) => {
        try {
            const msg = ctx.message.text
            if(msg == "❌ Отмена") {
                await ctx.scene.leave()
                await ctx.reply("Отлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
                return ctx.scene.enter("choosing_food_scene")
            } else {
                let servante = ''
                if(msg == "Приборы и салфетки нужны ✅") {
                    servante = "Да"
                } else {
                    servante = "Нет"
                }
                const userData = ctx.scene.state
                let cart = await utils.getCartInfo(ctx.message.from.id)
                let cartDishes = cart.cart_dishes
                const text = await utils.getCartText(cartDishes)
                const order = await utils.createOrder(ctx.message.from.id, ctx.scene.state)
                if(!userData.address) {//ТУТ ОТПРАВЛЯТСЯ ДОЛЖНО В CHAT
                    await ctx.telegram.sendLocation(process.env.GROUP_ID, userData.latitude, userData.longitude)
                }
                const addr = await Address.findOne({where: {customerUserId: ctx.message.from.id, address_name: userData.address}})
                if(addr.address) {
                    const data = addr.address.split(",")
                    if(data.length > 1) {
                        let lat = data[0]
                        let long = data[1]
                        if(!isNaN(parseInt(lat)) && !isNaN(parseInt(long))) {
                            await ctx.telegram.sendLocation(process.env.GROUP_ID, lat, long)
                        }   
                    }
                }
                userContext = await replyKeyboard.mainMenu()
                userContext.parse_mode = "HTML"
                await ctx.reply(`✅ Ваш заказ:
💳 Способ оплаты: ${userData.paymentType}
📞 Телефон: ${ (userData.phoneNumber[0] != '+') ? '+' + userData.phoneNumber : userData.phoneNumber }
${ (userData.address) ? "🏠 Адрес: " + userData.address : ""}

${text}

Приборы и салфетки нужны: <b>${servante}</b>

📋 Комментарий:
${ (userData.addInfo) ? userData.addInfo : "Пользователь не оставил комментария"}`, userContext)

                // context = replyKeyboard.confirmAdmin(order.id, ctx.message.from.id)
                context.parse_mode = "HTML"
                await ctx.telegram.sendMessage(process.env.GROUP_ID, `Заказ №${order.id}:
💳 Способ оплаты: ${userData.paymentType}
📞 Телефон: ${ (userData.phoneNumber[0] != '+') ? '+' + userData.phoneNumber : userData.phoneNumber }
${ (userData.address) ? "🏠 Адрес: " + userData.address : ""}

${text}

Приборы и салфетки нужны: <b>${servante}</b>

📋 Комментарий:
${ (userData.addInfo) ? userData.addInfo : "Пользователь не оставил комментария"}

Отправьте стоимость доставких в ответ на это сообщение`, context )
                await ctx.scene.leave()
                if(userData.paymentType != "💳 Payme") {
                    await ctx.reply(`Ваш заказ #${order.id} передан на обработку.\nСейчас Вам позвонит наш оператор.`, await replyKeyboard.mainMenu())
                }
                return ctx.scene.enter("choosing_food_scene")    
            }
        
                
        } catch(e) {
            await utils.sendError(ctx, e)
        }
    }

)

orderScene.hears("⬅️ назад", async ctx => {
    ctx.wizard.cursor -= 2;
    if (ctx.wizard.cursor < 0 || ctx.wizard.cursor == 0) {
        await await ctx.scene.leave()
        await ctx.reply("ℹОтлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu())
        // ctx.wizard.cursor = 0
        return ctx.scene.enter("choosing_food_scene")
    }
    ctx.wizard.selectStep(ctx.wizard.cursor)
    return ctx.wizard.steps[ctx.wizard.cursor](ctx)
})

module.exports = orderScene