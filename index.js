const {
    Client,
    GatewayIntentBits
} = require('discord.js');
const IgApiClient = require('instagram-private-api').IgApiClient;
const fs = require('fs');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
const channelid = 'CHANNEL_ID'; // your channel id of where posts will be sent
let ig;
const username = 'INSTAGRAM_USER_TO_GET_POSTS_FROM'; // user to monitor (example: notlieu)
let sentpostids = new Set();
let sentstoryids = new Set();

try {
    const postdata = fs.readFileSync('posts.txt', 'utf8');
    sentpostids = new Set(postdata.split('\n'));
    const storydata = fs.readFileSync('stories.txt', 'utf8');
    sentstoryids = new Set(storydata.split('\n'));
} catch (err) {
    console.error('error reading files;', err);
}

client.once('ready', async () => {
    console.log('!');
    ig = new IgApiClient();
    ig.state.generateDevice(username);
    await ig.account.login('INSTAGRAM_USERNAME', 'INSTAGRAM_PASSWORD');
    const user = await ig.user.searchExact(username);
    const userid = user.pk;
    const monitor = async () => {
        try {

            const feed = await ig.feed.user(userid).items();
            const newposts = feed.filter(item => !sentpostids.has(item.id));

            if (newposts.length > 0) {
                const channel = await client.channels.fetch(channelid);
                for (const item of newposts) {
                    const mediaurls = [];
                    if (item.carousel_media) {
                        for (const media of item.carousel_media) {
                            if (media.media_type === 2) {
                                mediaurls.push(media.video_versions[0].url);
                            } else {
                                mediaurls.push(media.image_versions2.candidates[0].url);
                            }
                        }
                    } else {
                        if (item.media_type === 2) {
                            mediaurls.push(item.video_versions[0].url);
                        } else {
                            mediaurls.push(item.image_versions2.candidates[0].url);
                        }
                    }
                    const message = `${username}: ${mediaurls.join('\n')}`;
                    await channel.send(message);
                    sentpostids.add(item.id);
                }
                const postdata = Array.from(sentpostids).join('\n');
                fs.writeFileSync('posts.txt', postdata);
            }

            const userstories = await ig.feed.userStory(userid);
            if (Array.isArray(userstories.items)) {
                const newstories = [];
                for (let i = 0; i < userstories.items.length; i++) {
                    const story = userstories.items[i];
                    if (!sentstoryids.has(story.id)) {
                        newstories.push(story);
                    }
                }

                if (newstories.length > 0) {
                    const channel = await client.channels.fetch(channelid);
                    for (const story of newstories) {
                        const mediaUrl = story.items[0].media_type === 2 ?
                            story.items[0].video_versions[0].url :
                            story.items[0].image_versions2.candidates[0].url;
                        await channel.send(`${username}'s story; ${mediaUrl}`);
                        sentstoryids.add(story.id);
                    }
                    const storydata = Array.from(sentstoryids).join('\n');
                    fs.writeFileSync('stories.txt', storydata);
                }
            }
        } catch (err) {
            console.error('error:', err);
        } finally {
            setTimeout(monitor, 60000);
        }
    };

    monitor();
});

client.login('DISCORD_BOT_TOKEN'); // your bots token here
