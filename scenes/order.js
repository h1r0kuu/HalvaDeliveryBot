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
                ctx.scene.state.phoneNumber = ctx.message.text
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
            if(ctx.message.location) {
                const lat = ctx.message.location.latitude
                const long = ctx.message.location.longitude
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
                    address_name: address
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
                userContext = await replyKeyboard.mainMenu()
                userContext.parse_mode = "HTML"
                await ctx.reply(`✅ Ваш заказ:
💳 Способ оплаты: ${userData.paymentType}
📞 Телефон: ${userData.phoneNumber}
${ (userData.address) ? "🏠 Адрес: " + userData.address : ""}

${text}

Приборы и салфетки нужны: <b>${servante}</b>

📋 Комментарий:
${ (userData.addInfo) ? userData.addInfo : "Пользователь не оставил комментария"}`, userContext)

                context = replyKeyboard.confirmAdmin(order.id, ctx.message.from.id)
                context.parse_mode = "HTML"
                await ctx.telegram.sendMessage(process.env.GROUP_ID, `Заказ №${order.id}:
💳 Способ оплаты: ${userData.paymentType}
📞 Телефон: ${userData.phoneNumber}
${ (userData.address) ? "🏠 Адрес: " + userData.address : ""}

${text}

Приборы и салфетки нужны: <b>${servante}</b>

📋 Комментарий:
${ (userData.addInfo) ? userData.addInfo : "Пользователь не оставил комментария"}`, context )
                
                await ctx.scene.leave()
                if(userData.paymentType != "💳 Payme") {
                    await ctx.reply(`Ваш заказ #${order.id} передан на обработку.\nСейчас Вам позвонит наш оператор.`, await replyKeyboard.mainMenu())
                } else {
                    const providerToken = process.env.PAYME_TOKEN

                    let totalPrice = 0
                    cartDishes.forEach(dish => {
                        let price = dish.amount * dish.dish.price 
                        totalPrice += price
                    })
                    // await ctx.reply("Оплата через: <b>Payme</b>\nСумма к оплате: " + totalPrice + "сум.\nЧто бы оплатить нажми кнопку \"✅ Оплатить\"", replyKeyboard.pay())
                    let invoice = {
                        chat_id: ctx.message.from.id, // Уникальный идентификатор целевого чата или имя пользователя целевого канала
                        provider_token: providerToken, // токен выданный через бот @SberbankPaymentBot 
                        start_parameter: 'get_access', //Уникальный параметр глубинных ссылок. Если оставить поле пустым, переадресованные копии отправленного сообщения будут иметь кнопку «Оплатить», позволяющую нескольким пользователям производить оплату непосредственно из пересылаемого сообщения, используя один и тот же счет. Если не пусто, перенаправленные копии отправленного сообщения будут иметь кнопку URL с глубокой ссылкой на бота (вместо кнопки оплаты) со значением, используемым в качестве начального параметра.
                        title: `Оплата через: Payme`, // Название продукта, 1-32 символа
                        description: `Сумма к оплате: ${totalPrice} сум.\nЧто бы оплатить нажми кнопку снизу`, // Описание продукта, 1-255 знаков
                        currency: 'UZS', // Трехбуквенный код валюты ISO 4217
                        prices: [{ label: 'Invoice Title', amount: parseInt(totalPrice) * 100}], // Разбивка цен, сериализованный список компонентов в формате JSON 100 копеек * 100 = 100 рублей
                        payload: { // Полезные данные счета-фактуры, определенные ботом, 1–128 байт. Это не будет отображаться пользователю, используйте его для своих внутренних процессов.
                          unique_id: `${ctx.message.from.id}_${order.id}`,
                          provider_token: providerToken
                        }
                    }
                    await ctx.replyWithInvoice(invoice)
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