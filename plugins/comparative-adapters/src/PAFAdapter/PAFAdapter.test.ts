import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0]!.get('refName')).toBe('Pp01')
  expect(fa2[0]!.get('refName')).toBe('chr1')
})

test('includeCigar: false omits the CIGAR but keeps coordinates', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape_cigar.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )

  const withCigar = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'chr1',
        start: 0,
        end: 100000,
        assemblyName: 'grape',
      })
      .pipe(toArray()),
  )
  const withoutCigar = await firstValueFrom(
    adapter
      .getFeatures(
        {
          refName: 'chr1',
          start: 0,
          end: 100000,
          assemblyName: 'grape',
        },
        { includeCigar: false },
      )
      .pipe(toArray()),
  )

  expect(withCigar.length).toBe(2)
  expect(withCigar[0]!.get('CIGAR')).toBe('100M5D100I1151M')
  expect(withoutCigar.length).toBe(withCigar.length)
  expect(withoutCigar[0]!.get('CIGAR')).toBeUndefined()
  expect(withoutCigar[0]!.get('start')).toBe(withCigar[0]!.get('start'))
  expect(withoutCigar[0]!.get('end')).toBe(withCigar[0]!.get('end'))
  expect(withoutCigar[0]!.get('mate')).toEqual(withCigar[0]!.get('mate'))
})
