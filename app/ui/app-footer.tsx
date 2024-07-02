import styles from '@/app/ui/app-footer.module.css';

export default function AppFooter() {
  return (
    <div className={styles.footer}>
      <div style={{ marginBottom: '1rem' }}>
        Follow GoldRoad on Twitter{' '}
        <a
          href='https://twitter.com/thegoldroad'
          target='_blank'
          rel='noreferrer'
        >
          @TheGoldRoad
        </a>
      </div>

      <div>
        Made with ❤️ & coffee, by{' '}
        <a
          href='https://twitter.com/ra_jeeves'
          target='_blank'
          rel='noreferrer'
        >
          @ra_jeeves
        </a>
      </div>
      <div>
        For feedback, or anything else{' '}
        <a href='mailto:i.rarsh@gmail.com?subject=[GoldRoad]'>Contact me</a>
      </div>
    </div>
  );
}
