import LoginService from '@/api/services/Logins'

const ITEMS = [
  {
    id: 1,
    username: 'yakuter@gmail.com',
    url: 'https://slack.com/',
    title: 'Slack',
    password: 'passWorD123',
    note:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's"
  },
  {
    id: 2,
    username: 'yakuter@gmail.com',
    url: 'https://www.gmail.com/',
    title: 'Gmail',
    password: 'passWorD123',
    note: 'Secret Note'
  },
  {
    id: 5,
    username: 'yakuter@gmail.com',
    url: 'https://9gag.com/',
    title: '9GAG',
    password: 'passWorD123',
    note: 'Secret Note'
  },
  {
    id: 4,
    username: 'yakuter@gmail.com',
    url: 'https://www.twitter.com/',
    title: 'Twitter',
    password: 'passWorD123',
    note: 'Secret Note'
  },
  {
    id: 3,
    username: 'yakuter@gmail.com',
    url: 'https://www.spotify.com/tr/',
    title: 'Spotify',
    password: 'passWorD123',
    note: 'Secret Note'
  },

  {
    id: 6,
    username: 'yakuter@gmail.com',
    url: 'https://www.gmail.com/',
    title: 'Gmail',
    password: 'passWorD123',
    note: 'Secret Note'
  },
  {
    id: 7,
    username: 'yakuter@gmail.com',
    url: 'https://www.gmail.com/',
    title: 'Gmail',
    password: 'passWorD123',
    note: 'Secret Note'
  },
  {
    id: 8,
    username: 'yakuter@gmail.com',
    url: 'https://www.gmail.com/',
    title: 'Gmail',
    password: 'passWorD123',
    note: 'Secret Note'
  }
]

export default {
  namespaced: true,

  state() {
    return {
      items: ITEMS,
      detail: null
    }
  },
  mutations: {},
  actions: {}
}
