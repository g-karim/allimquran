"""Exercise shipped endpoint functions without loading the ASR model/runtime."""
import ast
import asyncio
import copy
import json
import unittest
from pathlib import Path

SOURCE = Path(__file__).parents[1] / 'allimquran/asr/server.py'

class EndpointError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code


def endpoint_context(payload):
    calls = []
    async def run(function, key, url):
        calls.append((key, url))
        return copy.deepcopy(payload)
    context = dict(HTTPException=EndpointError, JSONResponse=lambda data: data,
                   QURAN_CONTENT_API='https://example.test', run_in_threadpool=run,
                   _cached_quran_json=lambda *args: None)
    tree = ast.parse(SOURCE.read_text())
    functions = [n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name in {'mushaf_page', 'locate_mushaf_verse'}]
    for node in functions: node.decorator_list = []
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(SOURCE), 'exec'), context)
    return context, calls


class MushafEditionTests(unittest.TestCase):
    def test_page_595_uses_one_edition_for_words_and_lines(self):
        # Metadata observed in the primary API: 92:14 is V1 page 595/line 15,
        # but V2 page 596/line 2. Generic page_number follows V2.
        payload = {'verses': [
            {'verse_key':'91:1', 'words':[{'v1_page':595,'v2_page':595,'line_v1':2,'line_v2':4,'page_number':595,'line_number':4}]},
            {'verse_key':'92:14','words':[{'v1_page':595,'v2_page':596,'line_v1':15,'line_v2':2,'page_number':596,'line_number':2}]},
        ]}
        c, calls = endpoint_context(payload)
        classic = asyncio.run(c['mushaf_page'](595, 2))
        self.assertEqual([v['verse_key'] for v in classic['verses']], ['91:1','92:14'])
        self.assertEqual([v['words'][0]['line_number'] for v in classic['verses']], [2,15])
        self.assertTrue(all(v['words'][0]['page_number']==595 for v in classic['verses']))
        self.assertIn('word_fields=code_v1,', calls[0][1])
        self.assertNotIn('code_v2', calls[0][1])
        modern = asyncio.run(c['mushaf_page'](595, 1))
        self.assertEqual([v['verse_key'] for v in modern['verses']], ['91:1'])
        modern_next = asyncio.run(c['mushaf_page'](596, 1))
        self.assertEqual([v['verse_key'] for v in modern_next['verses']], ['92:14'])
        self.assertEqual(modern_next['verses'][0]['words'][0]['line_number'], 2)

    def test_split_verse_keeps_full_text_for_recognition(self):
        words=[{'v1_page':1,'line_v1':15},{'v1_page':2,'line_v1':1}]
        c, _ = endpoint_context({'verses':[{'verse_key':'2:1','words':words}]})
        for page in [1,2]:
            result=asyncio.run(c['mushaf_page'](page,2))
            self.assertEqual(len(result['verses'][0]['words']),2)

    def test_location_and_invalid_edition(self):
        c,_=endpoint_context({'verse':{'v1_page':595,'v2_page':596,'page_number':596}})
        self.assertEqual(asyncio.run(c['locate_mushaf_verse'](92,14,2))['page'],595)
        self.assertEqual(asyncio.run(c['locate_mushaf_verse'](92,14,1))['page'],596)
        with self.assertRaises(EndpointError): asyncio.run(c['mushaf_page'](595,9))
        with self.assertRaises(EndpointError): asyncio.run(c['locate_mushaf_verse'](92,14,9))

if __name__ == '__main__': unittest.main()
