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

            const reelsfeed = ig.feed.reelsMedia({
                userIds: [userid],
            });
            const storyitems = await reelsfeed.items();

            if (storyitems.length > 0) {
                const channel = await client.channels.fetch(channelid);
                const newstories = storyitems.filter(story => !sentstoryids.has(story.id));

                for (const story of newstories) {
                    if (story.items && Array.isArray(story.items)) {
                        const storyMediaUrls = story.items.map(item => {
                            if (item.media_type === 2) {
                                return item.video_versions[0].url;
                            } else {
                                return item.image_versions2.candidates[0].url;
                            }
                        });

                        for (const mediaUrl of storyMediaUrls) {
                            console.log(mediaUrl)
                            await channel.send(`${username}'s story: ${mediaUrl}`);
                        }
                    }

                    sentstoryids.add(story.id);
                }

                const storydata = Array.from(sentstoryids).join('\n');
                fs.writeFileSync('stories.txt', storydata);
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
