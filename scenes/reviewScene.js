require("dotenv").config()
const {Telegraf, Scenes: {WizardScene, Stage}} = require("telegraf")
const replyKeyboard = require("../keyboards/replyKeyboard")
const {Customer} = require("../models/model")

const reviewScene = new WizardScene("review_scene",
    async ctx => {
        await ctx.reply("ℹ️Вы можете оценить наш сервис обслуживания или сообщить о возможной ошибке в боте", await replyKeyboard.back())
        return ctx.wizard.next()
    },

    async ctx => {
        const txt = ctx.message.text
        if(txt !== "⬅️ назад") {
            if(txt > 5) {
                await ctx.scene.leave()
                await ctx.telegram.sendMessage(process.env.GROUP_ID,`Новый отзыв ${ moment(new Date()).format("DD.MM.YYYY hh:mm:ss")}
Текст: ${text}
👤Пользователь: ${ctx.message.from.username} <a href="tg://user?id=${ctx.message.from.id}">Ссылка</a>
`, {parse_mode: "HTML"})
                await ctx.reply("Отзыв отправлен!")
                await ctx.scene.enter("choosing_food_scene")
            } else {
                await ctx.reply("Слишком короткое сообщение")
            }

        } else {
            await ctx.scene.leave()
            // await ctx.reply("Отлично! Оформим заказ вместе? 😃", await replyKeyboard.mainMenu() )
            return ctx.scene.enter("choosing_food_scene")
        }
    }
    
)

module.exports = reviewScene