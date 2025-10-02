import { expect, it } from 'vitest'
import { word_at_cursor } from '../src/utils/text.js'

it('parse word at cursor', () => {
    function w([str]: TemplateStringsArray) {
        const full = str!.replace('^', '')
        const result = word_at_cursor(full, str!.indexOf('^'))
        const flag = []
        for (const key in result) {
            if (key.startsWith('is')) {
                Reflect.get(result, key) === true && flag.push(key.slice(2))
            }
        }
        return `'${result.word}'${result.leadingContextWord ? `(context = ${result.leadingContextWord})` : ''} ; ${flag.length ? flag.join(' & ') : 'None'}\n${full}\n${' '.repeat(result.leftBoundary)}${'~'.repeat(result.rightBoundary - result.leftBoundary)}${' '.repeat(full.length - result.rightBoundary)}`
    }

    expect(w`^word`).toMatchInlineSnapshot(`
      "'word' ; None
      word
      ~~~~"
    `)
    expect(w`wo^rd`).toMatchInlineSnapshot(`
      "'word' ; None
      word
      ~~~~"
    `)
    expect(w`word^`).toMatchInlineSnapshot(`
      "'word' ; None
      word
      ~~~~"
    `)

    expect(w` ^word`).toMatchInlineSnapshot(`
      "'word' ; None
       word
       ~~~~"
    `)
    expect(w` wo^rd`).toMatchInlineSnapshot(`
      "'word' ; None
       word
       ~~~~"
    `)
    expect(w` word^`).toMatchInlineSnapshot(`
      "'word' ; None
       word
       ~~~~"
    `)

    expect(w`^word `).toMatchInlineSnapshot(`
      "'word' ; None
      word 
      ~~~~ "
    `)
    expect(w`wo^rd `).toMatchInlineSnapshot(`
      "'word' ; None
      word 
      ~~~~ "
    `)
    expect(w`word^ `).toMatchInlineSnapshot(`
      "'word' ; None
      word 
      ~~~~ "
    `)

    expect(w` ^word `).toMatchInlineSnapshot(`
      "'word' ; None
       word 
       ~~~~ "
    `)
    expect(w` wo^rd `).toMatchInlineSnapshot(`
      "'word' ; None
       word 
       ~~~~ "
    `)
    expect(w` word^ `).toMatchInlineSnapshot(`
      "'word' ; None
       word 
       ~~~~ "
    `)

    expect(w`Perform @@not_match ? Method(@@not_match2,@@ma^tch)`).toMatchInlineSnapshot(`
      "'match'(context = ?) ; WellKnownSymbol
      Perform @@not_match ? Method(@@not_match2,@@match)
                                                  ~~~~~ "
    `)
    expect(w`^%intrinsic%`).toMatchInlineSnapshot(`
      "'intrinsic' ; Intrinsic & IntrinsicLeading
      %intrinsic%
       ~~~~~~~~~ "
    `)
    expect(w`^_var_`).toMatchInlineSnapshot(`
      "'var' ; Variable & VariableLeading
      _var_
       ~~~ "
    `)
    expect(w`_^var_`).toMatchInlineSnapshot(`
      "'var' ; Variable & VariableLeading
      _var_
       ~~~ "
    `)
    expect(w`a ^|Grammar| production`).toMatchInlineSnapshot(`
      "'Grammar'(context = a) ; Grammar & GrammarLeading
      a |Grammar| production
         ~~~~~~~            "
    `)
    expect(w`a |^Grammar| production`).toMatchInlineSnapshot(`
      "'Grammar'(context = a) ; Grammar & GrammarLeading
      a |Grammar| production
         ~~~~~~~            "
    `)
    expect(w`a |Grammar|^ production`).toMatchInlineSnapshot(`
      "'Grammar'(context = a) ; Grammar & GrammarLeading
      a |Grammar| production
         ~~~~~~~            "
    `)
    expect(w`#sec^-data`).toMatchInlineSnapshot(`
      "'sec-data' ; Hash
      #sec-data
       ~~~~~~~~"
    `)

    expect(w` ^ `).toMatchInlineSnapshot(`
      "'' ; None
        
        "
    `)

    expect(w`? ^`).toMatchInlineSnapshot(`
      "''(context = ?) ; None
      ? 
        "
    `)
    expect(w`Perform ^`).toMatchInlineSnapshot(`
      "''(context = perform) ; None
      Perform 
              "
    `)
    expect(w`Perform Function^`).toMatchInlineSnapshot(`
      "'Function'(context = perform) ; None
      Perform Function
              ~~~~~~~~"
    `)
    expect(w`?Ca^`).toMatchInlineSnapshot(`
      "'Ca' ; Call
      ?Ca
       ~~"
    `)
    expect(w`?^`).toMatchInlineSnapshot(`
      "'' ; Call
      ?
       "
    `)
    expect(w`_iterator_^.[[Done]]`).toMatchInlineSnapshot(`
      "'iterator' ; Variable & VariableLeading
      _iterator_.[[Done]]
       ~~~~~~~~          "
    `)
})
